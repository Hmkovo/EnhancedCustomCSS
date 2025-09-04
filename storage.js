/**
 * 数据存储模块 - 管理所有数据的持久化存储
 * 修复版：支持云端SillyTavern的服务器端存储
 * 优化版：移除定期同步，只在操作时立即保存
 */

export class Storage {
    constructor(namespace) {
        this.namespace = namespace;
        this.prefix = `${namespace}_`;
        this.cache = new Map();
        this.listeners = new Map();
        
        // 标记是否使用服务器存储
        this.useServerStorage = false;
        
        // 检测是否在SillyTavern环境中
        this.checkEnvironment();
        
        // 初始化缓存
        this.loadCache();
        
        // 移除了定期同步！现在只在每次操作时立即保存
    }
    
    /**
     * 检测运行环境
     */
    checkEnvironment() {
        // 检查是否存在SillyTavern的全局对象
        if (typeof window !== 'undefined' && 
            window.extension_settings && 
            typeof saveSettingsDebounced === 'function') {
            this.useServerStorage = true;
            
            // 初始化扩展设置对象
            if (!window.extension_settings[this.namespace]) {
                window.extension_settings[this.namespace] = {
                    version: '2.0.0',
                    data: {}
                };
            }
            
            console.log(`[Storage] 检测到SillyTavern环境，启用服务器同步存储`);
        } else {
            console.log(`[Storage] 未检测到SillyTavern环境，使用本地存储`);
        }
    }
    
    /**
     * 生成存储键名
     */
    getKey(key) {
        return `${this.prefix}${key}`;
    }
    
    /**
     * 保存数据 - 同时保存到本地和服务器（立即保存）
     */
    async set(key, value) {
        try {
            // 1. 保存到缓存
            this.cache.set(key, value);
            
            // 2. 保存到localStorage（作为本地缓存）
            const fullKey = this.getKey(key);
            try {
                const serialized = JSON.stringify(value);
                localStorage.setItem(fullKey, serialized);
            } catch (localError) {
                console.warn(`[Storage] 本地存储失败，但会继续同步到服务器:`, localError.message);
            }
            
            // 3. 如果在SillyTavern环境，立即同步到服务器
            if (this.useServerStorage) {
                await this.saveToServer(key, value);
            }
            
            // 触发变更事件
            this.emit('changed', { key, value });
            this.emit(`changed:${key}`, value);
            
            return Promise.resolve();
        } catch (error) {
            console.error(`[Storage] 保存失败 (${key}):`, error);
            return Promise.reject(error);
        }
    }
    
    /**
     * 保存到服务器（立即执行）
     */
    async saveToServer(key, value) {
        if (!this.useServerStorage) return;
        
        try {
            // 确保扩展设置对象存在
            if (!window.extension_settings[this.namespace]) {
                window.extension_settings[this.namespace] = {
                    version: '2.0.0',
                    data: {}
                };
            }
            
            // 保存数据
            if (!window.extension_settings[this.namespace].data) {
                window.extension_settings[this.namespace].data = {};
            }
            
            // 存储数据和时间戳
            window.extension_settings[this.namespace].data[key] = {
                value: value,
                timestamp: new Date().toISOString()
            };
            
            // 立即调用SillyTavern的保存函数
            if (typeof saveSettingsDebounced === 'function') {
                saveSettingsDebounced();
                console.log(`[Storage] 数据已立即同步到服务器: ${key}`);
            }
        } catch (error) {
            console.error(`[Storage] 服务器保存失败:`, error);
        }
    }
    
    /**
     * 读取数据 - 优先从服务器读取
     */
    async get(key, defaultValue = null) {
        // 1. 先检查缓存
        if (this.cache.has(key)) {
            return Promise.resolve(this.cache.get(key));
        }
        
        // 2. 如果在SillyTavern环境，尝试从服务器读取
        if (this.useServerStorage) {
            const serverData = this.getFromServer(key);
            if (serverData !== null) {
                this.cache.set(key, serverData);
                
                // 同时更新本地存储
                const fullKey = this.getKey(key);
                try {
                    localStorage.setItem(fullKey, JSON.stringify(serverData));
                } catch (e) {
                    // 忽略本地存储错误
                }
                
                return Promise.resolve(serverData);
            }
        }
        
        // 3. 从localStorage读取（作为后备）
        const fullKey = this.getKey(key);
        try {
            const serialized = localStorage.getItem(fullKey);
            if (serialized !== null) {
                const value = JSON.parse(serialized);
                this.cache.set(key, value);
                
                // 如果服务器端没有，同步上去
                if (this.useServerStorage) {
                    this.saveToServer(key, value);
                }
                
                return Promise.resolve(value);
            }
        } catch (error) {
            console.warn(`[Storage] 本地读取失败 (${key}):`, error);
        }
        
        return Promise.resolve(defaultValue);
    }
    
    /**
     * 从服务器读取数据
     */
    getFromServer(key) {
        if (!this.useServerStorage) return null;
        
        try {
            if (window.extension_settings[this.namespace] && 
                window.extension_settings[this.namespace].data &&
                window.extension_settings[this.namespace].data[key]) {
                return window.extension_settings[this.namespace].data[key].value;
            }
        } catch (error) {
            console.error(`[Storage] 服务器读取失败:`, error);
        }
        
        return null;
    }
    
    /**
     * 删除数据 - 同时从本地和服务器删除
     */
    async remove(key) {
        try {
            // 1. 从缓存删除
            this.cache.delete(key);
            
            // 2. 从localStorage删除
            const fullKey = this.getKey(key);
            try {
                localStorage.removeItem(fullKey);
            } catch (e) {
                // 忽略本地存储错误
            }
            
            // 3. 从服务器删除（立即执行）
            if (this.useServerStorage) {
                await this.removeFromServer(key);
            }
            
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
     * 从服务器删除（立即执行）
     */
    async removeFromServer(key) {
        if (!this.useServerStorage) return;
        
        try {
            if (window.extension_settings[this.namespace] && 
                window.extension_settings[this.namespace].data) {
                delete window.extension_settings[this.namespace].data[key];
                
                if (typeof saveSettingsDebounced === 'function') {
                    saveSettingsDebounced();
                    console.log(`[Storage] 已立即从服务器删除: ${key}`);
                }
            }
        } catch (error) {
            console.error(`[Storage] 服务器删除失败:`, error);
        }
    }
    
    /**
     * 检查键是否存在
     */
    async has(key) {
        // 优先检查服务器
        if (this.useServerStorage) {
            const serverData = this.getFromServer(key);
            if (serverData !== null) return true;
        }
        
        // 检查本地
        const fullKey = this.getKey(key);
        return Promise.resolve(localStorage.getItem(fullKey) !== null);
    }
    
    /**
     * 清空所有数据 - 彻底清理
     */
    async clear() {
        try {
            console.log(`[Storage] 开始清空所有数据...`);
            
            // 1. 清空缓存
            this.cache.clear();
            
            // 2. 清空localStorage中的相关数据
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    keysToRemove.push(key);
                }
            }
            
            // 批量删除（避免在循环中修改localStorage）
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
            });
            
            console.log(`[Storage] 已清空 ${keysToRemove.length} 个本地存储项`);
            
            // 3. 清空服务器数据（立即执行）
            if (this.useServerStorage) {
                await this.clearServerData();
            }
            
            // 触发清空事件
            this.emit('cleared', null);
            
            console.log(`[Storage] 数据清空完成`);
            return Promise.resolve();
        } catch (error) {
            console.error(`[Storage] 清空失败:`, error);
            return Promise.reject(error);
        }
    }
    
    /**
     * 清空服务器数据（立即执行）
     */
    async clearServerData() {
        if (!this.useServerStorage) return;
        
        try {
            // 完全重置扩展设置
            window.extension_settings[this.namespace] = {
                version: '2.0.0',
                data: {},
                clearedAt: new Date().toISOString()
            };
            
            if (typeof saveSettingsDebounced === 'function') {
                saveSettingsDebounced();
                console.log(`[Storage] 服务器数据已立即清空`);
            }
        } catch (error) {
            console.error(`[Storage] 清空服务器数据失败:`, error);
        }
    }
    
    /**
     * 获取所有键名
     */
    getAllKeys() {
        const keys = new Set();
        
        // 1. 从服务器获取
        if (this.useServerStorage && 
            window.extension_settings[this.namespace] && 
            window.extension_settings[this.namespace].data) {
            Object.keys(window.extension_settings[this.namespace].data).forEach(key => {
                keys.add(this.getKey(key));
            });
        }
        
        // 2. 从localStorage获取
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                keys.add(key);
            }
        }
        
        return Array.from(keys);
    }
    
    /**
     * 获取所有数据
     */
    async getAll() {
        const data = {};
        
        // 优先从服务器获取
        if (this.useServerStorage && 
            window.extension_settings[this.namespace] && 
            window.extension_settings[this.namespace].data) {
            
            const serverData = window.extension_settings[this.namespace].data;
            for (const [key, item] of Object.entries(serverData)) {
                if (item && item.value !== undefined) {
                    data[key] = item.value;
                }
            }
            
            return Promise.resolve(data);
        }
        
        // 从localStorage获取
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
    async loadCache() {
        // 优先从服务器加载
        if (this.useServerStorage) {
            await this.loadFromServer();
        }
        
        // 补充从localStorage加载
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                keys.push(key);
            }
        }
        
        keys.forEach(fullKey => {
            const key = fullKey.replace(this.prefix, '');
            if (!this.cache.has(key)) {
                try {
                    const value = JSON.parse(localStorage.getItem(fullKey));
                    this.cache.set(key, value);
                } catch (error) {
                    console.warn(`[Storage] 缓存加载失败 (${key})`);
                }
            }
        });
        
        console.log(`[Storage] 缓存已加载，共 ${this.cache.size} 项`);
    }
    
    /**
     * 从服务器加载数据到缓存
     */
    async loadFromServer() {
        if (!this.useServerStorage) return;
        
        try {
            if (window.extension_settings[this.namespace] && 
                window.extension_settings[this.namespace].data) {
                
                const serverData = window.extension_settings[this.namespace].data;
                for (const [key, item] of Object.entries(serverData)) {
                    if (item && item.value !== undefined) {
                        this.cache.set(key, item.value);
                        
                        // 同时更新本地存储作为缓存
                        const fullKey = this.getKey(key);
                        try {
                            localStorage.setItem(fullKey, JSON.stringify(item.value));
                        } catch (e) {
                            // 忽略本地存储错误
                        }
                    }
                }
                
                console.log(`[Storage] 从服务器加载了 ${Object.keys(serverData).length} 项数据`);
            }
        } catch (error) {
            console.error(`[Storage] 服务器加载失败:`, error);
        }
    }
    
    /**
     * 手动批量同步到服务器（仅在导入数据等特殊情况使用）
     */
    async forceSyncToServer() {
        if (!this.useServerStorage) return;
        
        try {
            // 获取所有缓存的数据
            const allData = {};
            this.cache.forEach((value, key) => {
                allData[key] = {
                    value: value,
                    timestamp: new Date().toISOString()
                };
            });
            
            // 更新服务器数据
            if (!window.extension_settings[this.namespace]) {
                window.extension_settings[this.namespace] = {
                    version: '2.0.0',
                    data: {}
                };
            }
            
            window.extension_settings[this.namespace].data = allData;
            window.extension_settings[this.namespace].lastSync = new Date().toISOString();
            
            if (typeof saveSettingsDebounced === 'function') {
                saveSettingsDebounced();
                console.log(`[Storage] 手动批量同步完成，同步了 ${Object.keys(allData).length} 项数据`);
            }
        } catch (error) {
            console.error(`[Storage] 批量同步失败:`, error);
        }
    }
    
    /**
     * 导出所有数据
     */
    async export() {
        const data = await this.getAll();
        
        const exportData = {
            namespace: this.namespace,
            version: '2.0.0',
            exportDate: new Date().toISOString(),
            dataSource: this.useServerStorage ? 'server' : 'local',
            data: data
        };
        
        return JSON.stringify(exportData, null, 2);
    }
    
    /**
     * 导入数据
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
                // 等待清空操作完成
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // 导入数据（会自动保存到服务器）
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
     */
    getUsageStats() {
        let totalSize = 0;
        let itemCount = 0;
        
        // 计算服务器数据大小
        if (this.useServerStorage && 
            window.extension_settings[this.namespace] && 
            window.extension_settings[this.namespace].data) {
            const serverData = JSON.stringify(window.extension_settings[this.namespace].data);
            totalSize += serverData.length;
            itemCount = Object.keys(window.extension_settings[this.namespace].data).length;
        } else {
            // 计算本地数据大小
            const keys = this.getAllKeys();
            keys.forEach(fullKey => {
                const value = localStorage.getItem(fullKey);
                if (value) {
                    totalSize += value.length;
                    itemCount++;
                }
            });
        }
        
        // 估算总存储空间
        const estimatedTotal = this.useServerStorage ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
        const usagePercent = (totalSize / estimatedTotal) * 100;
        
        return {
            itemCount: itemCount,
            totalSize: totalSize,
            totalSizeFormatted: this.formatSize(totalSize),
            estimatedTotal: estimatedTotal,
            estimatedTotalFormatted: this.formatSize(estimatedTotal),
            usagePercent: usagePercent.toFixed(2) + '%',
            storageType: this.useServerStorage ? '服务器存储' : '本地存储'
        };
    }
    
    /**
     * 格式化文件大小
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
     */
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }
    
    /**
     * 触发事件
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
     * 注意：在使用服务器存储时，这个功能主要用于本地缓存更新
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
