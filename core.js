/**
 * 核心功能模块 - 提供基础DOM操作和样式管理
 * 负责：元素创建、类名管理、样式应用、脚本执行
 * 9.4修复：增强清理机制，防止CSS残留
 */

export class CoreModule {
    constructor(storage) {
        this.storage = storage;
        
        // 存储已添加的内容，用于清理
        this.addedElements = new Set();
        this.addedStyles = new Map(); // key: id, value: style element
        this.addedClasses = new Map(); // key: selector, value: Set of classNames
        this.modifiedElements = new Map(); // 记录被修改过的元素原始状态
        
        // 调试模式
        this.debugMode = false;
        
        // 清理标记，防止重复清理
        this.isClearing = false;
        
        // 记录所有通过扩展创建的元素的唯一标识
        this.elementIdCounter = 0;
        this.EXTENSION_MARKER = 'data-enhanced-css-element';
        this.EXTENSION_ID = 'data-enhanced-css-id';
    }
    
    /**
     * 初始化核心模块
     */
    async init() {
        this.debugMode = await this.storage.get('debugMode') || false;
        
        // 启动时先清理可能存在的旧元素
        this.cleanupOrphanElements();
        
        console.log('[CoreModule] 核心模块初始化完成');
    }
    
    /**
     * 清理孤立元素（页面刷新后可能残留的）
     */
    cleanupOrphanElements() {
        // 查找所有带扩展标记的元素
        const orphans = document.querySelectorAll(`[${this.EXTENSION_MARKER}]`);
        let cleaned = 0;
        
        orphans.forEach(element => {
            // 如果不在我们的追踪集合中，说明是孤立元素
            if (!this.addedElements.has(element)) {
                element.remove();
                cleaned++;
            }
        });
        
        if (cleaned > 0) {
            console.log(`[CoreModule] 清理了 ${cleaned} 个孤立元素`);
        }
        
        // 清理孤立的样式标签
        const orphanStyles = document.querySelectorAll('style[data-enhanced-css]');
        orphanStyles.forEach(style => {
            if (!Array.from(this.addedStyles.values()).includes(style)) {
                style.remove();
                cleaned++;
            }
        });
    }
    
    /**
     * 生成唯一ID
     */
    generateElementId() {
        return `enhanced-css-${Date.now()}-${++this.elementIdCounter}`;
    }
    
    /**
     * 创建元素
     */
    createElement(tag, options = {}) {
        const element = document.createElement(tag);
        const elementId = this.generateElementId();
        
        // 设置类名
        if (options.class) {
            element.className = options.class;
        }
        
        // 设置ID
        if (options.id) {
            element.id = options.id;
        }
        
        // 设置文本内容
        if (options.text) {
            element.textContent = options.text;
        }
        
        // 设置HTML内容
        if (options.html) {
            element.innerHTML = options.html;
        }
        
        // 设置样式
        if (options.style) {
            Object.assign(element.style, options.style);
        }
        
        // 设置属性
        if (options.attrs) {
            Object.entries(options.attrs).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        
        // 添加到父元素
        if (options.parent) {
            const parent = typeof options.parent === 'string' 
                ? document.querySelector(options.parent)
                : options.parent;
            
            if (parent) {
                parent.appendChild(element);
            }
        }
        
        // 标记为扩展创建的元素（双重标记）
        element.setAttribute(this.EXTENSION_MARKER, 'true');
        element.setAttribute(this.EXTENSION_ID, elementId);
        this.addedElements.add(element);
        
        if (this.debugMode) {
            console.log('[CoreModule] 创建元素:', tag, elementId, options);
        }
        
        return element;
    }
    
    /**
     * 为元素添加子元素
     */
    addElement(parentSelector, tag, options = {}) {
        const parent = typeof parentSelector === 'string'
            ? document.querySelector(parentSelector)
            : parentSelector;
        
        if (!parent) {
            console.warn('[CoreModule] 父元素不存在:', parentSelector);
            return null;
        }
        
        // 记录父元素的原始状态（如果还没记录过）
        if (!this.modifiedElements.has(parent)) {
            this.modifiedElements.set(parent, {
                originalPosition: parent.style.position || ''
            });
        }
        
        // 确保父元素有相对定位（如果子元素需要绝对定位）
        if (options.style && (options.style.position === 'absolute' || options.style.position === 'fixed')) {
            const computedStyle = getComputedStyle(parent);
            if (computedStyle.position === 'static') {
                parent.style.position = 'relative';
            }
        }
        
        return this.createElement(tag, { ...options, parent });
    }
    
    /**
     * 添加类名到元素
     */
    addClass(selector, className) {
        const elements = document.querySelectorAll(selector);
        
        elements.forEach(el => {
            // 记录原始类名
            if (!this.modifiedElements.has(el)) {
                this.modifiedElements.set(el, {
                    originalClasses: new Set(el.classList)
                });
            }
            
            const classes = className.split(' ').filter(Boolean);
            classes.forEach(cls => {
                el.classList.add(cls);
                
                // 记录添加的类名，用于清理
                if (!this.addedClasses.has(selector)) {
                    this.addedClasses.set(selector, new Set());
                }
                this.addedClasses.get(selector).add(cls);
            });
        });
        
        if (this.debugMode) {
            console.log(`[CoreModule] 添加类名 "${className}" 到 ${elements.length} 个元素`);
        }
    }
    
    /**
     * 应用CSS样式
     */
    applyCSS(css, id = null) {
        try {
            // 生成唯一ID
            const styleId = id || `enhanced-style-${Date.now()}-${this.elementIdCounter++}`;
            
            // 如果已存在相同ID的样式，先移除
            if (this.addedStyles.has(styleId)) {
                const oldStyle = this.addedStyles.get(styleId);
                if (oldStyle && oldStyle.parentNode) {
                    oldStyle.parentNode.removeChild(oldStyle);
                }
                this.addedStyles.delete(styleId);
            }
            
            // 创建新样式元素
            const style = document.createElement('style');
            style.setAttribute('data-enhanced-css', 'true');
            style.setAttribute('data-style-id', styleId);
            style.id = styleId;
            style.textContent = css;
            
            // 添加到head
            document.head.appendChild(style);
            
            // 记录样式元素
            this.addedStyles.set(styleId, style);
            
            if (this.debugMode) {
                console.log('[CoreModule] CSS应用成功', styleId);
            }
        } catch (error) {
            console.error('[CoreModule] CSS应用失败:', error);
        }
    }
    
    /**
     * 执行JavaScript代码
     */
    executeScript(code) {
        try {
            // 在执行前标记，防止执行过程中的元素不被追踪
            const executionId = `execution-${Date.now()}`;
            
            // 创建安全的执行环境
            const safeExecute = new Function(
                'document', 
                'window', 
                'EnhancedCSS',
                'executionId',
                `'use strict';\n${code}`
            );
            
            // 执行代码
            safeExecute(document, window, window.EnhancedCSS, executionId);
            
            if (this.debugMode) {
                console.log('[CoreModule] JavaScript执行成功');
            }
        } catch (error) {
            console.error('[CoreModule] JavaScript执行失败:', error);
            this.showError(error.message);
        }
    }
    
    /**
     * 显示错误提示
     */
    showError(message) {
        const errorDiv = this.createElement('div', {
            style: {
                position: 'fixed',
                top: '20px',
                right: '20px',
                background: '#ff4444',
                color: 'white',
                padding: '10px 15px',
                borderRadius: '5px',
                zIndex: '10000',
                maxWidth: '300px',
                animation: 'slideIn 0.3s ease',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
            },
            text: `Enhanced CSS Error: ${message}`
        });
        
        document.body.appendChild(errorDiv);
        
        // 5秒后移除
        setTimeout(() => {
            errorDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                errorDiv.remove();
                this.addedElements.delete(errorDiv);
            }, 300);
        }, 5000);
    }
    
    /**
     * 深度清理所有添加的内容
     */
    clearAll() {
        if (this.isClearing) {
            console.log('[CoreModule] 清理已在进行中，跳过');
            return;
        }
        
        this.isClearing = true;
        
        try {
            console.log('[CoreModule] 开始深度清理...');
            
            // 1. 清除追踪的元素
            const elementsToRemove = Array.from(this.addedElements);
            elementsToRemove.forEach(el => {
                try {
                    if (el && el.parentNode) {
                        el.remove();
                    }
                } catch (e) {
                    console.warn('[CoreModule] 清除元素失败:', e);
                }
            });
            this.addedElements.clear();
            
            // 2. 清除所有带扩展标记的元素（包括可能遗漏的）
            const markedElements = document.querySelectorAll(`[${this.EXTENSION_MARKER}]`);
            markedElements.forEach(el => {
                try {
                    el.remove();
                } catch (e) {
                    console.warn('[CoreModule] 清除标记元素失败:', e);
                }
            });
            
            // 3. 清除所有样式
            const stylesToRemove = Array.from(this.addedStyles.values());
            stylesToRemove.forEach(style => {
                try {
                    if (style && style.parentNode) {
                        style.remove();
                    }
                } catch (e) {
                    console.warn('[CoreModule] 清除样式失败:', e);
                }
            });
            this.addedStyles.clear();
            
            // 4. 清除所有带data-enhanced-css属性的样式（包括可能遗漏的）
            const enhancedStyles = document.querySelectorAll('style[data-enhanced-css]');
            enhancedStyles.forEach(style => {
                try {
                    style.remove();
                } catch (e) {
                    console.warn('[CoreModule] 清除增强样式失败:', e);
                }
            });
            
            // 5. 恢复被修改的元素
            this.modifiedElements.forEach((originalState, element) => {
                try {
                    // 恢复position样式
                    if (originalState.originalPosition !== undefined) {
                        if (originalState.originalPosition === '') {
                            element.style.removeProperty('position');
                        } else {
                            element.style.position = originalState.originalPosition;
                        }
                    }
                    
                    // 恢复原始类名
                    if (originalState.originalClasses) {
                        // 获取当前类名
                        const currentClasses = new Set(element.classList);
                        
                        // 移除不在原始类名中的类
                        currentClasses.forEach(cls => {
                            if (!originalState.originalClasses.has(cls)) {
                                element.classList.remove(cls);
                            }
                        });
                    }
                } catch (e) {
                    console.warn('[CoreModule] 恢复元素失败:', e);
                }
            });
            this.modifiedElements.clear();
            
            // 6. 清除添加的类名
            this.addedClasses.forEach((classes, selector) => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        classes.forEach(className => {
                            el.classList.remove(className);
                        });
                    });
                } catch (e) {
                    console.warn('[CoreModule] 清除类名失败:', e);
                }
            });
            this.addedClasses.clear();
            
            // 7. 重置计数器
            this.elementIdCounter = 0;
            
            console.log('[CoreModule] 深度清理完成');
            
        } finally {
            this.isClearing = false;
        }
    }
    
    /**
     * 快速清理（只清理元素和样式，不恢复修改）
     */
    quickClear() {
        // 批量移除元素
        const fragment = document.createDocumentFragment();
        
        // 移除标记的元素
        document.querySelectorAll(`[${this.EXTENSION_MARKER}]`).forEach(el => {
            if (el.parentNode) {
                fragment.appendChild(el);
            }
        });
        
        // 移除样式
        document.querySelectorAll('style[data-enhanced-css]').forEach(style => {
            if (style.parentNode) {
                fragment.appendChild(style);
            }
        });
        
        // 清空追踪集合
        this.addedElements.clear();
        this.addedStyles.clear();
        
        if (this.debugMode) {
            console.log('[CoreModule] 快速清理完成');
        }
    }
    
    /**
     * 设置调试模式
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            elements: this.addedElements.size,
            styles: this.addedStyles.size,
            classes: this.addedClasses.size,
            modified: this.modifiedElements.size
        };
    }
}
