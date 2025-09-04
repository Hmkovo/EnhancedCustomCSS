/**
 * CSS处理模块 - 解析和处理CSS内容，支持@add语法
 * 负责：CSS解析、@add语法处理、JavaScript提取
 */

export class CSSProcessor {
    constructor(core) {
        this.core = core;
    }
    
    /**
     * 处理CSS内容
     * @param {string} content - 原始CSS内容
     * @returns {Object} 处理结果
     */
    process(content) {
        const result = {
            css: '',
            javascript: '',
            addCommands: []
        };
        
        if (!content) return result;
        
        // 1. 提取JavaScript代码
        const jsExtracted = this.extractJavaScript(content);
        result.javascript = jsExtracted.javascript;
        
        // 2. 处理CSS内容（已移除JS）
        let cssContent = jsExtracted.css;
        
        // 3. 处理@add语法
        const addProcessed = this.processAddSyntax(cssContent);
        result.css = addProcessed.css;
        result.addCommands = addProcessed.commands;
        
        return result;
    }
    
    /**
     * 提取JavaScript代码
     * @param {string} content - 原始内容
     * @returns {Object} {css: string, javascript: string}
     */
    extractJavaScript(content) {
        let css = content;
        let javascript = '';
        
        // 匹配 <script> 标签
        const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        
        while ((match = scriptRegex.exec(content)) !== null) {
            javascript += match[1] + '\n';
            css = css.replace(match[0], '');
        }
        
        return {
            css: css.trim(),
            javascript: javascript.trim()
        };
    }
    
    /**
     * 处理@add语法
     * @param {string} css - CSS内容
     * @returns {Object} {css: string, commands: Array}
     */
    processAddSyntax(css) {
        const commands = [];
        let processedCSS = css;
        
        // 匹配CSS规则
        const ruleRegex = /([^{]+)\s*\{([^}]*)\}/g;
        let ruleMatch;
        
        while ((ruleMatch = ruleRegex.exec(css)) !== null) {
            const selector = ruleMatch[1].trim();
            const content = ruleMatch[2];
            
            // 匹配@add指令
            const addRegex = /@add:\s*([a-zA-Z0-9_-]+)\s+"([^"]*)"(?:\s+([^\s;]+))?(?:\s+([^\s;]+))?(?:\s+([^\s;]+))?(?:\s+([^\s;]+))?[;]?/g;
            let addMatch;
            
            while ((addMatch = addRegex.exec(content)) !== null) {
                const command = this.parseAddCommand(selector, addMatch);
                if (command) {
                    commands.push(command);
                    // 从CSS中移除@add指令
                    processedCSS = processedCSS.replace(addMatch[0], '');
                }
            }
        }
        
        return {
            css: processedCSS,
            commands: commands
        };
    }
    
    /**
     * 解析@add命令
     * @param {string} selector - CSS选择器
     * @param {Array} match - 正则匹配结果
     * @returns {Object} 命令对象
     */
    parseAddCommand(selector, match) {
        const className = match[1];
        const content = match[2];
        const params = [match[3], match[4], match[5], match[6]].filter(Boolean);
        
        // 判断内容类型
        if (content.startsWith('url(')) {
            // 图片类型
            return this.parseImageCommand(selector, className, content, params);
        } else {
            // 文本类型
            return this.parseTextCommand(selector, className, content, params);
        }
    }
    
    /**
     * 解析图片命令
     */
    parseImageCommand(selector, className, content, params) {
        const url = content.slice(4, -1); // 移除 url( 和 )
        let size = null;
        let position = {};
        
        params.forEach(param => {
            if (param && param.includes('x')) {
                // 尺寸参数 (如 100x100)
                size = param;
            } else if (param) {
                // 位置参数
                Object.assign(position, this.parsePosition(param));
            }
        });
        
        return {
            type: 'image',
            selector: selector,
            className: className,
            url: url,
            size: size,
            position: position
        };
    }
    
    /**
     * 解析文本命令
     */
    parseTextCommand(selector, className, content, params) {
        let position = {};
        
        params.forEach(param => {
            if (param) {
                Object.assign(position, this.parsePosition(param));
            }
        });
        
        return {
            type: 'text',
            selector: selector,
            className: className,
            text: content,
            position: position
        };
    }
    
    /**
     * 解析位置参数
     * @param {string} pos - 位置字符串
     * @returns {Object} 位置样式对象
     */
    parsePosition(pos) {
        if (!pos) return {};
        
        const style = {};
        
        // 支持负值（使用双减号表示）
        pos = pos.replace('--', 'NEG');
        
        // 匹配各种格式
        if (pos.includes('top')) {
            const value = pos.replace('top-', '').replace('top', '0');
            style.top = value.replace('NEG', '-');
        } else if (pos.includes('bottom')) {
            const value = pos.replace('bottom-', '').replace('bottom', '0');
            style.bottom = value.replace('NEG', '-');
        } else if (pos.includes('left')) {
            const value = pos.replace('left-', '').replace('left', '0');
            style.left = value.replace('NEG', '-');
        } else if (pos.includes('right')) {
            const value = pos.replace('right-', '').replace('right', '0');
            style.right = value.replace('NEG', '-');
        } else if (pos.includes('center')) {
            style.left = '50%';
            style.top = '50%';
            style.transform = 'translate(-50%, -50%)';
        }
        
        return style;
    }
    
    /**
     * 执行@add命令
     * @param {Array} commands - 命令数组
     */
    executeAddCommands(commands) {
        commands.forEach(cmd => {
            const elements = document.querySelectorAll(cmd.selector);
            
            elements.forEach(el => {
                let newElement;
                
                if (cmd.type === 'image') {
                    // 创建图片元素
                    newElement = this.createImageElement(cmd);
                } else {
                    // 创建文本元素
                    newElement = this.createTextElement(cmd);
                }
                
                // 应用通用样式
                newElement.style.position = 'absolute';
                Object.assign(newElement.style, cmd.position);
                
                // 标记为扩展创建的元素
                newElement.setAttribute('data-enhanced-css-element', 'true');
                
                // 确保父元素有相对定位
                if (getComputedStyle(el).position === 'static') {
                    el.style.position = 'relative';
                }
                
                // 添加到父元素
                el.appendChild(newElement);
                this.core.addedElements.add(newElement);
            });
        });
        
        console.log(`[CSSProcessor] 执行了 ${commands.length} 个@add命令`);
    }
    
    /**
     * 创建图片元素
     */
    createImageElement(cmd) {
        const element = document.createElement('div');
        element.className = `enhanced-add-${cmd.className}`;
        element.style.backgroundImage = `url(${cmd.url})`;
        element.style.backgroundSize = 'contain';
        element.style.backgroundRepeat = 'no-repeat';
        element.style.backgroundPosition = 'center';
        
        if (cmd.size) {
            const [width, height] = cmd.size.split('x');
            element.style.width = width + 'px';
            element.style.height = height + 'px';
        } else {
            // 默认尺寸
            element.style.width = '50px';
            element.style.height = '50px';
        }
        
        return element;
    }
    
    /**
     * 创建文本元素
     */
    createTextElement(cmd) {
        const element = document.createElement('span');
        element.className = `enhanced-add-${cmd.className}`;
        element.textContent = cmd.text;
        
        return element;
    }
    
    /**
     * 验证CSS语法
     * @param {string} css - CSS内容
     * @returns {boolean} 是否有效
     */
    validateCSS(css) {
        try {
            // 创建临时样式元素测试
            const testStyle = document.createElement('style');
            testStyle.textContent = css;
            
            // 暂时添加到文档
            document.head.appendChild(testStyle);
            
            // 检查是否有规则
            const hasRules = testStyle.sheet && testStyle.sheet.cssRules.length > 0;
            
            // 移除测试元素
            document.head.removeChild(testStyle);
            
            return hasRules;
        } catch (e) {
            console.warn('[CSSProcessor] CSS验证失败:', e.message);
            return false;
        }
    }
    
    /**
     * 优化CSS
     * @param {string} css - CSS内容
     * @returns {string} 优化后的CSS
     */
    optimizeCSS(css) {
        // 移除多余空格和换行
        let optimized = css
            .replace(/\/\*[\s\S]*?\*\//g, '') // 移除注释
            .replace(/\s+/g, ' ') // 合并空格
            .replace(/\s*([{}:;,])\s*/g, '$1') // 移除符号周围空格
            .trim();
        
        return optimized;
    }
    
    /**
     * 添加CSS前缀
     * @param {string} css - CSS内容
     * @returns {string} 添加前缀后的CSS
     */
    addVendorPrefixes(css) {
        const prefixes = ['-webkit-', '-moz-', '-ms-', '-o-'];
        const properties = [
            'animation',
            'transform',
            'transition',
            'box-shadow',
            'border-radius',
            'flex',
            'filter'
        ];
        
        let prefixed = css;
        
        properties.forEach(prop => {
            const regex = new RegExp(`(^|\\s|;)(${prop}:)`, 'gi');
            if (regex.test(css)) {
                prefixes.forEach(prefix => {
                    const prefixedProp = prefix + prop;
                    // 避免重复添加
                    if (!css.includes(prefixedProp)) {
                        prefixed = prefixed.replace(regex, `$1${prefixedProp}:$2`);
                    }
                });
            }
        });
        
        return prefixed;
    }
    
    /**
     * 解析CSS变量
     * @param {string} css - CSS内容
     * @returns {Object} 变量映射
     */
    parseCSSVariables(css) {
        const variables = {};
        const varRegex = /--([a-zA-Z0-9-]+):\s*([^;]+);/g;
        let match;
        
        while ((match = varRegex.exec(css)) !== null) {
            variables[match[1]] = match[2].trim();
        }
        
        return variables;
    }
    
    /**
     * 替换CSS变量
     * @param {string} css - CSS内容
     * @param {Object} variables - 变量映射
     * @returns {string} 替换后的CSS
     */
    replaceCSSVariables(css, variables) {
        let replaced = css;
        
        Object.entries(variables).forEach(([name, value]) => {
            const regex = new RegExp(`var\\(--${name}\\)`, 'g');
            replaced = replaced.replace(regex, value);
        });
        
        return replaced;
    }
}
