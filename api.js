/**
 * 智脉AI健康助手 - API服务
 * 对接后端服务器: http://47.110.151.230:3000
 * API接口:
 * - POST /api/get - 获取数据 {userId, type} -> []
 * - POST /api/save - 保存数据 {userId, type, data} -> {id}
 * - GET  /health - 健康检查
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
async function apiRequest(endpoint, method = 'POST', data = null) {
    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(url, options);
        const result = await response.json();
        return { success: true, ...result, _fromCloud: true };
    } catch (error) {
        console.error('API请求失败:', error);
        return { success: false, error: error.message, _fromCloud: false, _fallback: true };
    }
}

// ============ 数据存储API ============

const DataAPI = {
    // 获取用户数据
    async get(type) {
        const userId = getUserId();
        const result = await apiRequest('/get', 'POST', { userId, type });

        if (result.success && result.data) {
            // 保存到本地作为缓存
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

    // 保存用户数据
    async save(type, data) {
        const userId = getUserId();
        const result = await apiRequest('/save', 'POST', { userId, type, data });

        // 同时保存到本地
        localStorage.setItem(type, JSON.stringify(data));

        if (result._fallback) {
            return { success: true, _fallback: true, id: Date.now() };
        }

        return { ...result, _fromCloud: true };
    },

    // 同步所有数据（从云端拉取）
    async syncAll() {
        const types = ['medicines', 'bpRecords', 'bsRecords', 'profile', 'healthRecord', 'commonMedicines'];
        const results = {};

        for (const type of types) {
            const result = await DataAPI.get(type);
            if (result._fromCloud && result.data) {
                results[type] = result.data;
            }
        }

        return { success: true, data: results, _fromCloud: true };
    },

    // 上传所有数据到云端
    async uploadAll() {
        const types = ['medicines', 'bpRecords', 'bsRecords', 'profile', 'healthRecord', 'commonMedicines'];
        const results = {};

        for (const type of types) {
            const localData = localStorage.getItem(type);
            if (localData) {
                const result = await DataAPI.save(type, JSON.parse(localData));
                results[type] = result;
            }
        }

        return { success: true, data: results };
    }
};

// ============ 药品API ============

const MedicineAPI = {
    async getAll() {
        const result = await DataAPI.get('medicines');
        return {
            success: true,
            data: result.data || [],
            local: result._fallback
        };
    },

    async add(medicine) {
        const result = await DataAPI.get('medicines');
        const medicines = result.data || [];
        medicine.id = Date.now();
        medicine.createdAt = new Date().toISOString();
        medicines.push(medicine);

        const saveResult = await DataAPI.save('medicines', medicines);
        return { success: saveResult.success, data: medicine, local: saveResult._fallback };
    },

    async update(id, medicine) {
        const result = await DataAPI.get('medicines');
        const medicines = result.data || [];
        const index = medicines.findIndex(m => m.id == id);
        if (index >= 0) {
            medicines[index] = { ...medicines[index], ...medicine };
        }

        const saveResult = await DataAPI.save('medicines', medicines);
        return { success: saveResult.success, data: medicines[index], local: saveResult._fallback };
    },

    async delete(id) {
        const result = await DataAPI.get('medicines');
        let medicines = result.data || [];
        medicines = medicines.filter(m => m.id != id);

        const saveResult = await DataAPI.save('medicines', medicines);
        return { success: saveResult.success, local: saveResult._fallback };
    },

    async markTaken(id, taken) {
        const result = await DataAPI.get('medicines');
        const medicines = result.data || [];
        const medicine = medicines.find(m => m.id == id);
        if (medicine) {
            medicine.taken = taken;
            medicine.takenTime = taken ? new Date().toISOString() : null;
        }

        const saveResult = await DataAPI.save('medicines', medicines);
        return { success: saveResult.success, local: saveResult._fallback };
    },

    async resetToday() {
        const result = await DataAPI.get('medicines');
        const medicines = result.data || [];
        medicines.forEach(m => {
            m.taken = false;
            m.takenTime = null;
        });

        const saveResult = await DataAPI.save('medicines', medicines);
        return { success: saveResult.success, local: saveResult._fallback };
    }
};

// ============ 血压血糖记录API ============

const BPAPI = {
    async getRecords(type = 'bp') {
        const key = type === 'bs' ? 'bsRecords' : 'bpRecords';
        const result = await DataAPI.get(key);
        return {
            success: true,
            data: result.data || [],
            local: result._fallback
        };
    },

    async add(record) {
        const key = record.type === 'bs' ? 'bsRecords' : 'bpRecords';
        const result = await DataAPI.get(key);
        const records = result.data || [];
        record.id = Date.now();
        record.createdAt = new Date().toISOString();
        records.unshift(record);

        const saveResult = await DataAPI.save(key, records);
        return { success: saveResult.success, data: record, local: saveResult._fallback };
    },

    async delete(id, type) {
        const key = type === 'bs' ? 'bsRecords' : 'bpRecords';
        const result = await DataAPI.get(key);
        let records = result.data || [];
        records = records.filter(r => r.id != id);

        const saveResult = await DataAPI.save(key, records);
        return { success: saveResult.success, local: saveResult._fallback };
    }
};

// ============ 健康档案API ============

const ProfileAPI = {
    async get() {
        const result = await DataAPI.get('profile');
        return {
            success: true,
            data: result.data || {},
            local: result._fallback
        };
    },

    async update(profileData) {
        const result = await DataAPI.get('profile');
        const profile = { ...(result.data || {}), ...profileData };
        profile.updatedAt = new Date().toISOString();

        const saveResult = await DataAPI.save('profile', profile);
        return { success: saveResult.success, data: profile, local: saveResult._fallback };
    }
};

// ============ 健康检查 ============

async function checkAPIHealth() {
    try {
        const response = await fetch('http://47.110.151.230:3000/health');
        const result = await response.json();
        return result.success !== false || result.status === 'ok';
    } catch {
        return false;
    }
}

// ============ 导出 ============

window.HealthAPI = {
    Data: DataAPI,
    Medicine: MedicineAPI,
    BP: BPAPI,
    Profile: ProfileAPI,
    checkHealth: checkAPIHealth,
    getUserId
};
