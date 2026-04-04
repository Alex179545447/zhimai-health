/**
 * 智脉AI健康助手 - API服务
 * 连接后端服务器，实现数据云端存储
 */

const API_BASE_URL = 'https://health-api.zhimai-ai.cn/api';

// 获取用户ID（本地存储）
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
        
        return result;
    } catch (error) {
        console.error('API请求失败:', error);
        // 如果API不可用，回退到localStorage
        return { success: false, error: error.message, fallback: true };
    }
}

// ============ 药品API ============

const MedicineAPI = {
    // 获取所有药品
    async getAll() {
        const result = await apiRequest('/medicines');
        if (result.fallback || !result.success) {
            // 回退到localStorage
            return { success: true, data: JSON.parse(localStorage.getItem('medicines') || '[]'), local: true };
        }
        return result;
    },

    // 添加药品
    async add(medicine) {
        const result = await apiRequest('/medicines', 'POST', medicine);
        if (result.fallback || !result.success) {
            // 回退到localStorage
            const medicines = JSON.parse(localStorage.getItem('medicines') || '[]');
            medicine.id = Date.now();
            medicine.createdAt = new Date().toISOString();
            medicines.push(medicine);
            localStorage.setItem('medicines', JSON.stringify(medicines));
            return { success: true, data: medicine, local: true };
        }
        return result;
    },

    // 更新药品
    async update(id, medicine) {
        const result = await apiRequest(`/medicines/${id}`, 'PUT', medicine);
        if (result.fallback || !result.success) {
            const medicines = JSON.parse(localStorage.getItem('medicines') || '[]');
            const index = medicines.findIndex(m => m.id == id);
            if (index >= 0) {
                medicines[index] = { ...medicines[index], ...medicine };
                localStorage.setItem('medicines', JSON.stringify(medicines));
            }
            return { success: true, data: medicines[index], local: true };
        }
        return result;
    },

    // 删除药品
    async delete(id) {
        const result = await apiRequest(`/medicines/${id}`, 'DELETE');
        if (result.fallback || !result.success) {
            let medicines = JSON.parse(localStorage.getItem('medicines') || '[]');
            medicines = medicines.filter(m => m.id != id);
            localStorage.setItem('medicines', JSON.stringify(medicines));
            return { success: true, local: true };
        }
        return result;
    },

    // 标记服用
    async take(id, taken) {
        const result = await apiRequest(`/medicines/${id}/take`, 'POST', { taken });
        if (result.fallback || !result.success) {
            let medicines = JSON.parse(localStorage.getItem('medicines') || '[]');
            const medicine = medicines.find(m => m.id == id);
            if (medicine) {
                medicine.taken = taken;
                medicine.takenTime = taken ? new Date().toISOString() : null;
                localStorage.setItem('medicines', JSON.stringify(medicines));
            }
            return { success: true, local: true };
        }
        return result;
    },

    // 重置今日
    async resetToday() {
        const result = await apiRequest('/medicines/reset-today', 'POST');
        if (result.fallback || !result.success) {
            let medicines = JSON.parse(localStorage.getItem('medicines') || '[]');
            medicines.forEach(m => {
                m.taken = false;
                m.takenTime = null;
            });
            localStorage.setItem('medicines', JSON.stringify(medicines));
            return { success: true, local: true };
        }
        return result;
    }
};

// ============ 血压血糖记录API ============

const BPAPI = {
    // 获取记录
    async getRecords(type = null, limit = null) {
        let endpoint = '/bp-records';
        const params = [];
        if (type) params.push(`type=${type}`);
        if (limit) params.push(`limit=${limit}`);
        if (params.length > 0) endpoint += '?' + params.join('&');

        const result = await apiRequest(endpoint);
        if (result.fallback || !result.success) {
            const key = type === 'bp' ? 'bpRecords' : type === 'bs' ? 'bsRecords' : 'bpRecords';
            return { success: true, data: JSON.parse(localStorage.getItem(key) || '[]'), local: true };
        }
        return result;
    },

    // 添加记录
    async add(record) {
        const result = await apiRequest('/bp-records', 'POST', record);
        if (result.fallback || !result.success) {
            const key = record.type === 'bp' ? 'bpRecords' : 'bsRecords';
            const records = JSON.parse(localStorage.getItem(key) || '[]');
            record.id = Date.now();
            record.createdAt = new Date().toISOString();
            records.unshift(record);
            localStorage.setItem(key, JSON.stringify(records));
            return { success: true, data: record, local: true };
        }
        return result;
    },

    // 删除记录
    async delete(id, type) {
        const result = await apiRequest(`/bp-records/${id}`, 'DELETE');
        if (result.fallback || !result.success) {
            const key = type === 'bp' ? 'bpRecords' : 'bsRecords';
            let records = JSON.parse(localStorage.getItem(key) || '[]');
            records = records.filter(r => r.id != id);
            localStorage.setItem(key, JSON.stringify(records));
            return { success: true, local: true };
        }
        return result;
    }
};

// ============ 就医提醒API ============

const ReminderAPI = {
    // 获取提醒
    async getAll(status = null) {
        let endpoint = '/reminders';
        if (status) endpoint += `?status=${status}`;

        const result = await apiRequest(endpoint);
        if (result.fallback || !result.success) {
            return { success: true, data: JSON.parse(localStorage.getItem('reminders') || '[]'), local: true };
        }
        return result;
    },

    // 添加提醒
    async add(reminder) {
        const result = await apiRequest('/reminders', 'POST', reminder);
        if (result.fallback || !result.success) {
            const reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
            reminder.id = Date.now();
            reminder.createdAt = new Date().toISOString();
            reminder.status = 'pending';
            reminders.push(reminder);
            localStorage.setItem('reminders', JSON.stringify(reminders));
            return { success: true, data: reminder, local: true };
        }
        return result;
    },

    // 更新提醒
    async update(id, reminder) {
        const result = await apiRequest(`/reminders/${id}`, 'PUT', reminder);
        if (result.fallback || !result.success) {
            let reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
            const index = reminders.findIndex(r => r.id == id);
            if (index >= 0) {
                reminders[index] = { ...reminders[index], ...reminder };
                localStorage.setItem('reminders', JSON.stringify(reminders));
            }
            return { success: true, data: reminders[index], local: true };
        }
        return result;
    },

    // 删除提醒
    async delete(id) {
        const result = await apiRequest(`/reminders/${id}`, 'DELETE');
        if (result.fallback || !result.success) {
            let reminders = JSON.parse(localStorage.getItem('reminders') || '[]');
            reminders = reminders.filter(r => r.id != id);
            localStorage.setItem('reminders', JSON.stringify(reminders));
            return { success: true, local: true };
        }
        return result;
    }
};

// ============ 用户信息API ============

const UserAPI = {
    // 获取用户信息
    async get() {
        const result = await apiRequest('/user');
        if (result.fallback || !result.success) {
            return { success: true, data: JSON.parse(localStorage.getItem('healthRecord') || '{}'), local: true };
        }
        return result;
    },

    // 更新用户信息
    async update(userData) {
        const result = await apiRequest('/user', 'PUT', userData);
        if (result.fallback || !result.success) {
            const current = JSON.parse(localStorage.getItem('healthRecord') || '{}');
            const updated = { ...current, ...userData };
            localStorage.setItem('healthRecord', JSON.stringify(updated));
            return { success: true, data: updated, local: true };
        }
        return result;
    }
};

// ============ 统计API ============

const StatsAPI = {
    async get() {
        const result = await apiRequest('/stats');
        if (result.fallback || !result.success) {
            // 计算本地统计
            const medicines = JSON.parse(localStorage.getItem('medicines') || '[]');
            const todayMeds = medicines.filter(m => m.frequency !== 'once');
            const taken = todayMeds.filter(m => m.taken).length;
            
            const bpRecords = JSON.parse(localStorage.getItem('bpRecords') || '[]');
            const today = new Date().toISOString().split('T')[0];
            const todayBP = bpRecords.filter(r => r.measureTime && r.measureTime.startsWith(today)).length;

            return {
                success: true,
                data: {
                    medicine: { total: todayMeds.length, taken, pending: todayMeds.length - taken },
                    bloodPressure: { today: todayBP },
                    reminders: { thisWeek: 0 }
                },
                local: true
            };
        }
        return result;
    }
};

// 健康检查
async function checkAPIHealth() {
    try {
        const result = await apiRequest('/health');
        return result.success;
    } catch {
        return false;
    }
}

// 导出
window.HealthAPI = {
    Medicine: MedicineAPI,
    BP: BPAPI,
    Reminder: ReminderAPI,
    User: UserAPI,
    Stats: StatsAPI,
    checkHealth: checkAPIHealth,
    getUserId
};
