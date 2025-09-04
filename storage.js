/**
 * 数据存储模块 - 管理所有数据的持久化存储
 * 使用localStorage进行本地存储，提供统一的存储接口
 */

export class Storage {
    constructor(namespace) {
        this.namespace = namespace;
        this.prefix = `${namespace}_`;
        this.cache = new Map();
        this.listeners = new Map();
        
        // 初始化缓存
        this.loadCache();
    }
    
    /**
     * 生成存储键名
     * @param {string} key - 原始键名
     * @returns {string} 带命名空间的键名
     */
    getKey(key) {
        return `${this.prefix}${key}`;
    }
    
    /**
     * 保存数据
     * @param {string} key - 键名
     * @param {*} value - 数据值
     * @returns {Promise<void>}
     */
    async set(key, value) {
        const fullKey = this.getKey(key);
        
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(fullKey, serialized);
            
            // 更新缓存
            this.cache.set(key, value);
            
            // 触发变更事件
            this.emit('changed', { key, value });
            this.emit(`changed:${key}`, value);
            
            return Promise.resolve();
        } catch (error) {
            console.error(`[Storage] 保存失败 (${key}):`, error);
            
            // 如果是存储空间不足
            if (error.name === 'QuotaExceededError') {
                // 尝试清理旧数据
                this.cleanup();
                
                // 重试一次
                try {
                    const serialized = JSON.stringify(value);
                    localStorage.setItem(fullKey, serialized);
                    this.cache.set(key, value);
                    return Promise.resolve();
                } catch (retryError) {
                    return Promise.reject(new Error('存储空间不足'));
                }
            }
            
            return Promise.reject(error);
        }
    }
    
    /**
     * 读取数据
     * @param {string} key - 键名
     * @param {*} defaultValue - 默认值
     * @returns {Promise<*>}
     */
    async get(key, defaultValue = null) {
        // 先检查缓存
        if (this.cache.has(key)) {
            return Promise.resolve(this.cache.get(key));
        }
        
        const fullKey = this.getKey(key);
        
        try {
            const serialized = localStorage.getItem(fullKey);
            
            if (serialized === null) {
                return Promise.resolve(defaultValue);
            }
            
            const value = JSON.parse(serialized);
            
            // 更新缓存
            this.cache.set(key, value);
            
            return Promise.resolve(value);
        } catch (error) {
            console.error(`[Storage] 读取失败 (${key}):`, error);
            return Promise.resolve(defaultValue);
        }
    }
    
    /**
     * 删除数据
     * @param {string} key - 键名
     * @returns {Promise<void>}
     */
    async remove(key) {
        const fullKey = this.getKey(key);
        
        try {
            localStorage.removeItem(fullKey);
            this.cache.delete(key);
            
            // 触发删除事件
            this.emit('removed', key);
            this.emit(`removed:${key}`, null);
            
            return Promise.resolve();
        } catch (error) {
            console.error(`[Storage] 删除失败 (${key}):`, error);
            return Promise.reject(error);
        }
    }
    
    /**
     * 检查键是否存在
     * @param {string} key - 键名
     * @returns {Promise<boolean>}
     */
    async has(key) {
        const fullKey = this.getKey(key);
        return Promise.resolve(localStorage.getItem(fullKey) !== null);
    }
    
    /**
     * 清空所有数据
     * @returns {Promise<void>}
     */
    async clear() {
        try {
            // 获取所有相关键
            const keys = this.getAllKeys();
            
            // 逐个删除
            keys.forEach(key => {
                localStorage.removeItem(key);
            });
            
            // 清空缓存
            this.cache.clear();
            
            // 触发清空事件
            this.emit('cleared', null);
            
            console.log(`[Storage] 已清空所有 ${this.namespace} 数据`);
            return Promise.resolve();
        } catch (error) {
            console.error(`[Storage] 清空失败:`, error);
            return Promise.reject(error);
        }
    }
    
    /**
     * 获取所有键名
     * @returns {Array<string>}
     */
    getAllKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                keys.push(key);
            }
        }
        return keys;
    }
    
    /**
     * 获取所有数据
     * @returns {Promise<Object>}
     */
    async getAll() {
        const data = {};
        const keys = this.getAllKeys();
        
        for (const fullKey of keys) {
            const key = fullKey.replace(this.prefix, '');
            try {
                const value = JSON.parse(localStorage.getItem(fullKey));
                data[key] = value;
            } catch (error) {
                console.warn(`[Storage] 跳过损坏的数据 (${key})`);
            }
        }
        
        return Promise.resolve(data);
    }
    
    /**
     * 批量设置数据
     * @param {Object} data - 数据对象
     * @returns {Promise<void>}
     */
    async setMultiple(data) {
        const errors = [];
        
        for (const [key, value] of Object.entries(data)) {
            try {
                await this.set(key, value);
            } catch (error) {
                errors.push({ key, error });
            }
        }
        
        if (errors.length > 0) {
            console.warn(`[Storage] 批量设置部分失败:`, errors);
        }
        
        return Promise.resolve();
    }
    
    /**
     * 加载缓存
     */
    loadCache() {
        const keys = this.getAllKeys();
        
        keys.forEach(fullKey => {
            const key = fullKey.replace(this.prefix, '');
            try {
                const value = JSON.parse(localStorage.getItem(fullKey));
                this.cache.set(key, value);
            } catch (error) {
                console.warn(`[Storage] 缓存加载失败 (${key})`);
            }
        });
        
        console.log(`[Storage] 缓存已加载，共 ${this.cache.size} 项`);
    }
    
    /**
     * 清理旧数据（当存储空间不足时）
     */
    cleanup() {
        // 获取所有数据并按时间戳排序
        const allData = [];
        const keys = this.getAllKeys();
        
        keys.forEach(fullKey => {
            const key = fullKey.replace(this.prefix, '');
            try {
                const value = JSON.parse(localStorage.getItem(fullKey));
                
                // 假设某些数据有时间戳
                const timestamp = value.timestamp || value.addedAt || 0;
                allData.push({ key, timestamp, size: localStorage.getItem(fullKey).length });
            } catch (error) {
                // 损坏的数据直接删除
                localStorage.removeItem(fullKey);
            }
        });
        
        // 按时间戳排序（旧的在前）
        allData.sort((a, b) => a.timestamp - b.timestamp);
        
        // 删除最旧的20%数据
        const deleteCount = Math.floor(allData.length * 0.2);
        for (let i = 0; i < deleteCount; i++) {
            this.remove(allData[i].key);
        }
        
        console.log(`[Storage] 清理了 ${deleteCount} 项旧数据`);
    }
    
    /**
     * 导出所有数据
     * @returns {Promise<string>} JSON字符串
     */
    async export() {
        const data = await this.getAll();
        
        const exportData = {
            namespace: this.namespace,
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            data: data
        };
        
        return JSON.stringify(exportData, null, 2);
    }
    
    /**
     * 导入数据
     * @param {string} jsonString - JSON字符串
     * @param {boolean} merge - 是否合并
     * @returns {Promise<number>} 导入的项数
     */
    async import(jsonString, merge = true) {
        try {
            const importData = JSON.parse(jsonString);
            
            if (!importData.data) {
                throw new Error('无效的导入数据格式');
            }
            
            // 如果不合并，先清空
            if (!merge) {
                await this.clear();
            }
            
            // 导入数据
            await this.setMultiple(importData.data);
            
            const count = Object.keys(importData.data).length;
            console.log(`[Storage] 成功导入 ${count} 项数据`);
            
            return count;
        } catch (error) {
            console.error('[Storage] 导入失败:', error);
            throw error;
        }
    }
    
    /**
     * 获取存储使用情况
     * @returns {Object} 使用情况统计
     */
    getUsageStats() {
        let totalSize = 0;
        let itemCount = 0;
        const keys = this.getAllKeys();
        
        keys.forEach(fullKey => {
            const value = localStorage.getItem(fullKey);
            if (value) {
                totalSize += value.length;
                itemCount++;
            }
        });
        
        // 估算总存储空间（通常是5-10MB）
        const estimatedTotal = 5 * 1024 * 1024; // 5MB
        const usagePercent = (totalSize / estimatedTotal) * 100;
        
        return {
            itemCount: itemCount,
            totalSize: totalSize,
            totalSizeFormatted: this.formatSize(totalSize),
            estimatedTotal: estimatedTotal,
            estimatedTotalFormatted: this.formatSize(estimatedTotal),
            usagePercent: usagePercent.toFixed(2) + '%'
        };
    }
    
    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化的大小
     */
    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * 监听事件
     * @param {string} event - 事件名
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消监听的函数
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        
        this.listeners.get(event).add(callback);
        
        // 返回取消监听的函数
        return () => {
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }
    
    /**
     * 取消监听
     * @param {string} event - 事件名
     * @param {Function} callback - 回调函数
     */
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }
    
    /**
     * 触发事件
     * @param {string} event - 事件名
     * @param {*} data - 事件数据
     */
    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[Storage] 事件处理器错误 (${event}):`, error);
                }
            });
        }
    }
    
    /**
     * 监听localStorage变化（跨标签页同步）
     */
    watchStorageChanges() {
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith(this.prefix)) {
                const key = e.key.replace(this.prefix, '');
                
                try {
                    const newValue = e.newValue ? JSON.parse(e.newValue) : null;
                    const oldValue = e.oldValue ? JSON.parse(e.oldValue) : null;
                    
                    // 更新缓存
                    if (newValue !== null) {
                        this.cache.set(key, newValue);
                    } else {
                        this.cache.delete(key);
                    }
                    
                    // 触发事件
                    this.emit('externalChange', {
                        key: key,
                        newValue: newValue,
                        oldValue: oldValue
                    });
                } catch (error) {
                    console.warn('[Storage] 处理外部变化失败:', error);
                }
            }
        });
    }
}
