/**
 * 智脉AI健康助手 - API服务
 * 对接后端服务器: http://47.110.151.230:3000
 * 实现用户注册/登录和数据云端同步
 */

// API基础地址
const API_BASE_URL = 'http://47.110.151.230:3000/api';

// 获取或创建用户ID
function getUserId() {
    let userId = localStorage.getItem('health_user_id');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('health_user_id', userId);
    }
    return userId;
}

// API请求封装
async function apiRequest(endpoint, method = 'GET', data = null) {
    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-User-ID': getUserId()
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);
        const result = await response.json();

        // 如果服务器返回了新的userId，保存它
        if (result.userId) {
            localStorage.setItem('health_user_id', result.userId);
        }

        return { ...result, _fromCloud: true };
    } catch (error) {
        console.error('API请求失败:', error);
        // API失败时回退到localStorage
        return { success: false, error: error.message, _fromCloud: false, _fallback: true };
    }
}

// ============ 用户认证API ============

const AuthAPI = {
    // 注册
    async register(username, password) {
        const userId = getUserId();
        const result = await apiRequest('/register', 'POST', {
            userId,
            username: username || 'user_' + Date.now(),
            password: password || '',
            createdAt: new Date().toISOString()
        });

        if (result.success) {
            // 保存登录状态
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userInfo', JSON.stringify({
                userId: result.userId || userId,
                username: username,
                loginTime: new Date().toISOString()
            }));
        }

        return result;
    },

    // 登录
    async login(username, password) {
        const userId = getUserId();
        const result = await apiRequest('/login', 'POST', {
            userId,
            username: username || 'guest',
            password: password || ''
        });

        if (result.success) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userInfo', JSON.stringify({
                userId: result.userId || userId,
                username: username,
                loginTime: new Date().toISOString()
            }));
        }

        return result;
    },

    // 检查登录状态
    isLoggedIn() {
        return localStorage.getItem('isLoggedIn') === 'true';
    },

    // 退出登录
    logout() {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userInfo');
        // 保留userId，下次登录可以关联数据
    }
};

// ============ 数据存储API ============

const DataAPI = {
    // 保存用户数据（药品、血压、档案等）
    async saveData(type, data) {
        const userId = getUserId();
        const result = await apiRequest('/save', 'POST', {
            userId,
            type,  // 'medicines', 'bpRecords', 'bsRecords', 'profile', 'healthRecord', 'reminders'
            data,
            updatedAt: new Date().toISOString()
        });

        if (result._fallback) {
            // 回退到localStorage
            localStorage.setItem(type, JSON.stringify(data));
            return { success: true, _fallback: true };
        }

        // 同时保存到本地作为备份
        localStorage.setItem(type, JSON.stringify(data));

        return result;
    },

    // 获取用户数据
    async getData(type) {
        const userId = getUserId();
        const result = await apiRequest('/get', 'POST', {
            userId,
            type
        });

        if (result.success && result.data) {
            // 优先使用云端数据，同时更新本地
            localStorage.setItem(type, JSON.stringify(result.data));
            return { ...result, _fromCloud: true };
        }

        // 回退到localStorage
        const localData = localStorage.getItem(type);
        return {
            success: true,
            data: localData ? JSON.parse(localData) : null,
            _fallback: true,
            _fromCloud: false
        };
    },

    // 批量同步所有数据
    async syncAll() {
        const userId = getUserId();
        const dataTypes = ['medicines', 'bpRecords', 'bsRecords', 'profile', 'healthRecord', 'commonMedicines', 'reminders'];
        const cloudData = {};

        // 获取所有云端数据
        for (const type of dataTypes) {
            const result = await DataAPI.getData(type);
            if (result._fromCloud && result.data) {
                cloudData[type] = result.data;
            }
        }

        // 合并数据（云端优先，或取较新的）
        for (const type of dataTypes) {
            if (cloudData[type]) {
                localStorage.setItem(type, JSON.stringify(cloudData[type]));
            }
        }

        return { success: true, data: cloudData };
    },

    // 上传所有本地数据到云端
    async uploadAll() {
        const userId = getUserId();
        const dataTypes = ['medicines', 'bpRecords', 'bsRecords', 'profile', 'healthRecord', 'commonMedicines', 'reminders'];
        const allData = {};

        for (const type of dataTypes) {
            const localData = localStorage.getItem(type);
            if (localData) {
                allData[type] = JSON.parse(localData);
            }
        }

        const result = await apiRequest('/save', 'POST', {
            userId,
            type: 'all',
            data: allData,
            updatedAt: new Date().toISOString()
        });

        return result;
    }
};

// ============ 药品API ============

const MedicineAPI = {
    async getAll() {
        const result = await DataAPI.getData('medicines');
        return {
            success: true,
            data: result.data || [],
            local: result._fallback
        };
    },

    async add(medicine) {
        const result = await DataAPI.getData('medicines');
        const medicines = result.data || [];
        medicine.id = Date.now();
        medicine.createdAt = new Date().toISOString();
        medicines.push(medicine);

        const saveResult = await DataAPI.saveData('medicines', medicines);
        return { success: saveResult.success, data: medicine, local: saveResult._fallback };
    },

    async update(id, medicine) {
        const result = await DataAPI.getData('medicines');
        const medicines = result.data || [];
        const index = medicines.findIndex(m => m.id == id);
        if (index >= 0) {
            medicines[index] = { ...medicines[index], ...medicine };
        }

        const saveResult = await DataAPI.saveData('medicines', medicines);
        return { success: saveResult.success, data: medicines[index], local: saveResult._fallback };
    },

    async delete(id) {
        const result = await DataAPI.getData('medicines');
        let medicines = result.data || [];
        medicines = medicines.filter(m => m.id != id);

        const saveResult = await DataAPI.saveData('medicines', medicines);
        return { success: saveResult.success, local: saveResult._fallback };
    },

    async markTaken(id, taken) {
        const result = await DataAPI.getData('medicines');
        const medicines = result.data || [];
        const medicine = medicines.find(m => m.id == id);
        if (medicine) {
            medicine.taken = taken;
            medicine.takenTime = taken ? new Date().toISOString() : null;
        }

        const saveResult = await DataAPI.saveData('medicines', medicines);
        return { success: saveResult.success, local: saveResult._fallback };
    },

    async resetToday() {
        const result = await DataAPI.getData('medicines');
        const medicines = result.data || [];
        medicines.forEach(m => {
            m.taken = false;
            m.takenTime = null;
        });

        const saveResult = await DataAPI.saveData('medicines', medicines);
        return { success: saveResult.success, local: saveResult._fallback };
    }
};

// ============ 血压血糖记录API ============

const BPAPI = {
    async getRecords(type = 'bp') {
        const key = type === 'bs' ? 'bsRecords' : 'bpRecords';
        const result = await DataAPI.getData(key);
        return {
            success: true,
            data: result.data || [],
            local: result._fallback
        };
    },

    async add(record) {
        const key = record.type === 'bs' ? 'bsRecords' : 'bpRecords';
        const result = await DataAPI.getData(key);
        const records = result.data || [];
        record.id = Date.now();
        record.createdAt = new Date().toISOString();
        records.unshift(record);

        const saveResult = await DataAPI.saveData(key, records);
        return { success: saveResult.success, data: record, local: saveResult._fallback };
    },

    async delete(id, type) {
        const key = type === 'bs' ? 'bsRecords' : 'bpRecords';
        const result = await DataAPI.getData(key);
        let records = result.data || [];
        records = records.filter(r => r.id != id);

        const saveResult = await DataAPI.saveData(key, records);
        return { success: saveResult.success, local: saveResult._fallback };
    }
};

// ============ 健康档案API ============

const ProfileAPI = {
    async get() {
        const result = await DataAPI.getData('profile');
        return {
            success: true,
            data: result.data || {},
            local: result._fallback
        };
    },

    async update(profileData) {
        const result = await DataAPI.getData('profile');
        const profile = { ...(result.data || {}), ...profileData };
        profile.updatedAt = new Date().toISOString();

        const saveResult = await DataAPI.saveData('profile', profile);
        return { success: saveResult.success, data: profile, local: saveResult._fallback };
    }
};

// ============ 健康检查 ============

async function checkAPIHealth() {
    try {
        const response = await fetch('http://47.110.151.230:3000/health');
        const result = await response.json();
        return result.success !== false;
    } catch {
        return false;
    }
}

// ============ 导出 ============

window.HealthAPI = {
    Auth: AuthAPI,
    Data: DataAPI,
    Medicine: MedicineAPI,
    BP: BPAPI,
    Profile: ProfileAPI,
    checkHealth: checkAPIHealth,
    getUserId
};
