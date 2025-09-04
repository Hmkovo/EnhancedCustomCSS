/**
 * 核心功能模块 - 提供基础DOM操作和样式管理
 * 负责：元素创建、类名管理、样式应用、脚本执行
 */

export class CoreModule {
    constructor(storage) {
        this.storage = storage;
        
        // 存储已添加的内容，用于清理
        this.addedElements = new Set();
        this.addedStyles = new Map(); // key: id, value: style element
        this.addedClasses = new Map(); // key: selector, value: Set of classNames
        
        // 调试模式
        this.debugMode = false;
    }
    
    /**
     * 初始化核心模块
     */
    async init() {
        this.debugMode = await this.storage.get('debugMode') || false;
        console.log('[CoreModule] 核心模块初始化完成');
    }
    
    /**
     * 创建元素
     * @param {string} tag - 标签名
     * @param {Object} options - 元素选项
     * @returns {HTMLElement} 创建的元素
     */
    createElement(tag, options = {}) {
        const element = document.createElement(tag);
        
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
        
        // 标记为扩展创建的元素
        element.setAttribute('data-enhanced-css-element', 'true');
        this.addedElements.add(element);
        
        if (this.debugMode) {
            console.log('[CoreModule] 创建元素:', tag, options);
        }
        
        return element;
    }
    
    /**
     * 为元素添加子元素
     * @param {string|HTMLElement} parentSelector - 父元素选择器或元素
     * @param {string} tag - 标签名
     * @param {Object} options - 元素选项
     * @returns {HTMLElement|null} 创建的元素
     */
    addElement(parentSelector, tag, options = {}) {
        const parent = typeof parentSelector === 'string'
            ? document.querySelector(parentSelector)
            : parentSelector;
        
        if (!parent) {
            console.warn('[CoreModule] 父元素不存在:', parentSelector);
            return null;
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
     * @param {string} selector - 选择器
     * @param {string} className - 类名（可以是多个，空格分隔）
     */
    addClass(selector, className) {
        const elements = document.querySelectorAll(selector);
        
        elements.forEach(el => {
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
     * @param {string} css - CSS内容
     * @param {string} id - 样式ID（用于替换已存在的样式）
     */
    applyCSS(css, id = null) {
        try {
            // 如果有ID且已存在，先移除旧的
            if (id && this.addedStyles.has(id)) {
                const oldStyle = this.addedStyles.get(id);
                if (oldStyle && oldStyle.parentNode) {
                    oldStyle.parentNode.removeChild(oldStyle);
                }
            }
            
            // 创建新样式元素
            const style = document.createElement('style');
            style.setAttribute('data-enhanced-css', 'true');
            if (id) {
                style.id = id;
            }
            style.textContent = css;
            
            // 添加到head
            document.head.appendChild(style);
            
            // 记录样式元素
            if (id) {
                this.addedStyles.set(id, style);
            } else {
                this.addedStyles.set(`style-${Date.now()}`, style);
            }
            
            if (this.debugMode) {
                console.log('[CoreModule] CSS应用成功', id || 'anonymous');
            }
        } catch (error) {
            console.error('[CoreModule] CSS应用失败:', error);
        }
    }
    
    /**
     * 执行JavaScript代码
     * @param {string} code - JavaScript代码
     */
    executeScript(code) {
        try {
            // 创建安全的执行环境
            const safeExecute = new Function(
                'document', 
                'window', 
                'EnhancedCSS',
                `'use strict';\n${code}`
            );
            
            // 执行代码
            safeExecute(document, window, window.EnhancedCSS);
            
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
     * @param {string} message - 错误消息
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 10000;
            max-width: 300px;
            animation: slideIn 0.3s ease;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        errorDiv.textContent = `Enhanced CSS Error: ${message}`;
        document.body.appendChild(errorDiv);
        
        // 5秒后移除
        setTimeout(() => {
            errorDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => errorDiv.remove(), 300);
        }, 5000);
    }
    
    /**
     * 清除所有添加的内容
     */
    clearAll() {
        // 清除元素
        this.addedElements.forEach(el => {
            if (el && el.parentNode) {
                el.remove();
            }
        });
        this.addedElements.clear();
        
        // 清除通过data属性标记的元素
        document.querySelectorAll('[data-enhanced-css-element]').forEach(el => {
            el.remove();
        });
        
        // 清除样式
        this.addedStyles.forEach(style => {
            if (style && style.parentNode) {
                style.remove();
            }
        });
        this.addedStyles.clear();
        
        // 清除添加的类名
        this.addedClasses.forEach((classes, selector) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                classes.forEach(className => {
                    el.classList.remove(className);
                });
            });
        });
        this.addedClasses.clear();
        
        if (this.debugMode) {
            console.log('[CoreModule] 清除所有添加的内容');
        }
    }
    
    /**
     * 设置调试模式
     * @param {boolean} enabled - 是否启用调试
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
}
