/**
 * 字体管理模块 - 管理字体的添加、删除、切换、标签分类
 * 支持从zeoseven.com解析字体链接，批量管理，导入导出
 */

export class FontManager {
    constructor(storage, core) {
        this.storage = storage;
        this.core = core;
        
        // 字体列表
        this.fonts = new Map(); // key: fontName, value: font object
        this.currentFont = null;
        
        // 标签系统
        this.tags = new Set();
        this.currentTag = 'all'; // 当前筛选的标签
        
        // 事件监听器
        this.listeners = new Map();
    }
    
    /**
     * 初始化字体管理器
     */
    async init() {
        // 加载保存的字体
        await this.loadFonts();
        
        // 加载当前字体设置
        const currentFontName = await this.storage.get('currentFont');
        if (currentFontName && this.fonts.has(currentFontName)) {
            this.currentFont = currentFontName;
        }
        
        console.log('[FontManager] 字体管理器初始化完成，已加载', this.fonts.size, '个字体');
    }
    
    /**
     * 解析字体链接（支持zeoseven.com格式）
     * @param {string} input - 输入的字体代码
     * @returns {Object|null} 解析后的字体对象
     */
    parseFont(input) {
        // 匹配 @import url 格式
        const importMatch = input.match(/@import\s+url\(["']([^"']+)["']\)/);
        if (!importMatch) {
            console.warn('[FontManager] 无法解析字体链接');
            return null;
        }
        
        const url = importMatch[1];
        
        // 匹配 font-family
        const familyMatch = input.match(/font-family:\s*["']?([^"';]+)["']?/);
        const fontFamily = familyMatch ? familyMatch[1].trim() : 'Unknown Font';
        
        // 从URL中提取字体ID（如果是zeoseven链接）
        let fontId = null;
        const idMatch = url.match(/fontsapi\.zeoseven\.com\/(\d+)\//);
        if (idMatch) {
            fontId = idMatch[1];
        }
        
        // 生成默认名称
        const defaultName = fontFamily || `Font-${Date.now()}`;
        
        return {
            name: defaultName,
            displayName: defaultName, // 用户可编辑的显示名称
            url: url,
            fontFamily: fontFamily,
            fontId: fontId,
            tags: [],
            order: Date.now(), // 排序顺序
            addedAt: new Date().toISOString(),
            custom: {} // 用户自定义数据
        };
    }
    
    /**
     * 添加字体
     * @param {Object} fontData - 字体数据
     * @returns {boolean} 是否添加成功
     */
    async addFont(fontData) {
        // 如果是字符串，先解析
        if (typeof fontData === 'string') {
            fontData = this.parseFont(fontData);
            if (!fontData) return false;
        }
        
        // 检查重复
        if (this.fonts.has(fontData.name)) {
            console.warn('[FontManager] 字体已存在:', fontData.name);
            return false;
        }
        
        // 添加到集合
        this.fonts.set(fontData.name, fontData);
        
        // 更新标签
        if (fontData.tags && fontData.tags.length > 0) {
            fontData.tags.forEach(tag => this.tags.add(tag));
        }
        
        // 保存
        await this.saveFonts();
        
        // 触发事件
        this.emit('fontAdded', fontData);
        
        console.log('[FontManager] 添加字体:', fontData.name);
        return true;
    }
    
    /**
     * 更新字体信息
     * @param {string} fontName - 原字体名称
     * @param {Object} updates - 更新的数据
     */
    async updateFont(fontName, updates) {
        const font = this.fonts.get(fontName);
        if (!font) return false;
        
        // 如果更改了名称，需要更新Map的key
        if (updates.name && updates.name !== fontName) {
            this.fonts.delete(fontName);
            this.fonts.set(updates.name, { ...font, ...updates });
            
            // 如果是当前字体，更新引用
            if (this.currentFont === fontName) {
                this.currentFont = updates.name;
            }
        } else {
            this.fonts.set(fontName, { ...font, ...updates });
        }
        
        // 更新标签集合
        if (updates.tags) {
            this.updateTagsList();
        }
        
        // 保存
        await this.saveFonts();
        
        // 触发事件
        this.emit('fontUpdated', { oldName: fontName, font: this.fonts.get(updates.name || fontName) });
        
        return true;
    }
    
    /**
     * 删除字体
     * @param {string} fontName - 字体名称
     */
    async removeFont(fontName) {
        if (!this.fonts.has(fontName)) return false;
        
        const font = this.fonts.get(fontName);
        this.fonts.delete(fontName);
        
        // 如果删除的是当前字体，清除选择
        if (this.currentFont === fontName) {
            this.currentFont = null;
            this.emit('fontChanged', null);
        }
        
        // 更新标签列表
        this.updateTagsList();
        
        // 保存
        await this.saveFonts();
        
        // 触发事件
        this.emit('fontRemoved', font);
        
        return true;
    }
    
    /**
     * 设置当前字体
     * @param {string} fontName - 字体名称
     */
    async setCurrentFont(fontName) {
        if (!this.fonts.has(fontName)) {
            console.warn('[FontManager] 字体不存在:', fontName);
            return false;
        }
        
        this.currentFont = fontName;
        await this.storage.set('currentFont', fontName);
        
        // 触发事件
        this.emit('fontChanged', fontName);
        
        return true;
    }
    
    /**
     * 获取当前字体
     */
    getCurrentFont() {
        return this.currentFont ? this.fonts.get(this.currentFont) : null;
    }
    
    /**
     * 获取字体
     * @param {string} fontName - 字体名称
     */
    getFont(fontName) {
        return this.fonts.get(fontName);
    }
    
    /**
     * 获取所有字体
     * @param {string} tag - 标签筛选（可选）
     */
    getAllFonts(tag = null) {
        const fontsArray = Array.from(this.fonts.values());
        
        // 标签筛选
        if (tag && tag !== 'all') {
            return fontsArray.filter(font => 
                font.tags && font.tags.includes(tag)
            );
        }
        
        return fontsArray;
    }
    
    /**
     * 按标签分组获取字体
     */
    getFontsByTags() {
        const grouped = {
            all: this.getAllFonts(),
            untagged: []
        };
        
        // 初始化标签组
        this.tags.forEach(tag => {
            grouped[tag] = [];
        });
        
        // 分组
        this.fonts.forEach(font => {
            if (!font.tags || font.tags.length === 0) {
                grouped.untagged.push(font);
            } else {
                font.tags.forEach(tag => {
                    if (grouped[tag]) {
                        grouped[tag].push(font);
                    }
                });
            }
        });
        
        return grouped;
    }
    
    /**
     * 更新字体排序
     * @param {Array} sortedNames - 排序后的字体名称数组
     */
    async updateOrder(sortedNames) {
        sortedNames.forEach((name, index) => {
            const font = this.fonts.get(name);
            if (font) {
                font.order = index;
            }
        });
        
        await this.saveFonts();
        this.emit('orderChanged', sortedNames);
    }
    
    /**
     * 导出字体配置
     * @returns {string} JSON字符串
     */
    exportFonts() {
        const exportData = {
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            fonts: Array.from(this.fonts.values()),
            currentFont: this.currentFont,
            tags: Array.from(this.tags)
        };
        
        return JSON.stringify(exportData, null, 2);
    }
    
    /**
     * 导入字体配置
     * @param {string} jsonData - JSON数据
     * @param {boolean} merge - 是否合并（true）或替换（false）
     */
    async importFonts(jsonData, merge = true) {
        try {
            const data = JSON.parse(jsonData);
            
            if (!data.fonts || !Array.isArray(data.fonts)) {
                throw new Error('无效的导入数据格式');
            }
            
            // 如果不合并，先清空
            if (!merge) {
                this.fonts.clear();
                this.tags.clear();
            }
            
            // 导入字体
            let imported = 0;
            data.fonts.forEach(font => {
                // 如果合并模式且字体已存在，跳过
                if (merge && this.fonts.has(font.name)) {
                    console.log('[FontManager] 跳过已存在的字体:', font.name);
                    return;
                }
                
                this.fonts.set(font.name, font);
                
                // 更新标签
                if (font.tags && font.tags.length > 0) {
                    font.tags.forEach(tag => this.tags.add(tag));
                }
                
                imported++;
            });
            
            // 设置当前字体
            if (data.currentFont && this.fonts.has(data.currentFont)) {
                this.currentFont = data.currentFont;
            }
            
            // 保存
            await this.saveFonts();
            
            // 触发事件
            this.emit('fontsImported', { count: imported, total: data.fonts.length });
            
            console.log(`[FontManager] 导入完成，成功导入 ${imported}/${data.fonts.length} 个字体`);
            return imported;
        } catch (error) {
            console.error('[FontManager] 导入失败:', error);
            throw error;
        }
    }
    
    /**
     * 批量添加字体
     * @param {Array} fontsData - 字体数据数组
     */
    async addFontsBatch(fontsData) {
        let added = 0;
        
        for (const fontData of fontsData) {
            if (await this.addFont(fontData)) {
                added++;
            }
        }
        
        return added;
    }
    
    /**
     * 更新标签列表
     */
    updateTagsList() {
        this.tags.clear();
        this.fonts.forEach(font => {
            if (font.tags && font.tags.length > 0) {
                font.tags.forEach(tag => this.tags.add(tag));
            }
        });
    }
    
    /**
     * 保存字体到存储
     */
    async saveFonts() {
        const data = {
            fonts: Array.from(this.fonts.entries()),
            tags: Array.from(this.tags),
            currentFont: this.currentFont
        };
        
        await this.storage.set('fonts', data);
    }
    
    /**
     * 从存储加载字体
     */
    async loadFonts() {
        const data = await this.storage.get('fonts');
        
        if (data) {
            // 恢复字体Map
            if (data.fonts && Array.isArray(data.fonts)) {
                this.fonts = new Map(data.fonts);
            }
            
            // 恢复标签Set
            if (data.tags && Array.isArray(data.tags)) {
                this.tags = new Set(data.tags);
            }
            
            // 恢复当前字体
            if (data.currentFont) {
                this.currentFont = data.currentFont;
            }
        }
    }
    
    /**
     * 事件监听
     * @param {string} event - 事件名
     * @param {Function} callback - 回调函数
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    /**
     * 触发事件
     * @param {string} event - 事件名
     * @param {*} data - 事件数据
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[FontManager] 事件处理器错误 (${event}):`, error);
                }
            });
        }
    }
}
