!(function($) {
    "use strict";

    var Submiter = {};

    // @FIX: в имени иппута - []
    $.fn.senderForms = function(options) {
            
        var 
            v = new Submiter.validator(options)
            , ruler, rule, collector, ruleParam;

        v.form = $(this);

        options.rules = options.rules || v.getFieldNames();

        $.each(options.rules, function(fieldName) { 

            rule        = options.rules[fieldName];
            collector   = v.addField(fieldName);

            if (!!rule) {
                for(var ruleName in rule) {
                    if (!v.issetRule(ruleName)) {
                        continue;
                    }

                    ruleParam = rule[ruleName];

                    if (ruleParam.param) {
                        collector.ruler(new Submiter.RulesHandler(ruleName, ruleParam.param, ruleParam.message));   
                    } else {
                        if ('equalTo' == ruleName) {
                            ruleParam = v.form.find(ruleParam);
                        }

                        collector.ruler(new Submiter.RulesHandler(ruleName, ruleParam));
                    }

                    // устанавлием текущий нод, для некоторых валидаций
                    collector.addNode( v.getField(fieldName) );

                }               
            }


            // добавляем поле с ошибками
            if(options.errorFields && options.errorFields[fieldName]) {
                v.setErrorField(fieldName);
            }           
        });  

        v.init();

        return this;
    }


    /**
    * Главный обработчик
    */
    Submiter.validator = function(opts) {

        $.extend(this.settings = {}, opts);

        // настройки полей
        this.fields = {};

        // количество ошибок
        this.errors   = 0;
        this.errField = {};

        this.ajaxStart = function() {

            this.ajax = $.ajax({
                url         : opts.ajax.url,
                type        : opts.ajax.type || "GET",
                cache       : false,
                data        : this.getAjaxData(),
                dataType    : opts.ajax.dataType || 'json',
                beforeSend  : opts.ajax.beforeSend || function() {}
            }); 


        }

    }

    Submiter.validator.prototype = {

        init: function() {

            var that = this;

            this.form.submit(function(e) {

                // run func befor a validation
                if (that.settings.beforeValid) {
                    that.settings.beforeValid();
                }

                that.valid();

                // show errors
                if (that.errors > 0) {
                    that.renderErrors();

                    e.preventDefault();
                    return;
                }

                if( that.isAjax() ) {
                    that.ajaxStart();

                    if (undefined !== that.settings.submitHandler) {
                        that.ajax.success(that.settings.submitHandler);
                    }
                
                    e.preventDefault(); 
                }


                // run func after a validation
                if (that.settings.afterValid) {
                    that.settings.afterValid( !!(that.errors > 0) );
                }
                
            });
        },

        renderErrors: function() {

            var errorHandler, privileged, nodeErr, callback;

            for(var field in this.errField) {

                privileged  = this.errField[field]['privileged'];
                nodeErr     = this.errField[field][privileged];
                
                // display box with an error
                if (nodeErr.errorNode) {
                    nodeErr.errorNode
                        .show()
                        .text(nodeErr.errorText)
                }

                callback = function() {};

                // call func while the error
                if (this.settings.invalidHandlers && this.settings.invalidHandlers[field]) {
                    callback = this.settings.invalidHandlers[field][privileged];
                } else if (this.settings.everyMiss) {
                    callback = this.settings.everyMiss;
                }
            
                callback.apply(window, [nodeErr.errorNode, nodeErr.errorText, this.getField(field)]);
            }

        },

        isAjax: function() {
            return this.settings.ajax && !!this.settings.ajax.url;
        },

        getFieldNames: function(r) {

            r = r || false;

            var f = {}, name, that = this;

            this.ajaxData = {};

            this.form.find('input, textarea').each(function() {
                if ( undefined !== (name = $(this).attr('name')) ) {
                    f[name]             = null; 
                    that.ajaxData[name] = $(this).val();
                }
            });

            return r ? this.ajaxData : f;
        },

        getAjaxData: function() {
            var d = this.settings.ajax.data || [], that = this;

            this.ajaxData = {};

            if (d.length > 0) {
                d.forEach(function(v) {
                    that.ajaxData[v] = that.getValue(v);
                });
            } else {
                this.ajaxData = this.getFieldNames(true);
            }

            return this.ajaxData;
        },

        clearData: function() {
            this.errField = {};
            this.errors   = 0;
        },

        getRules: function() {
            return this.rules;
        },

        getValue : function(fieldName) {
            return this.getField(fieldName).val();  
        },

        getField: function(fieldName) {
            return this.form.find('input[name='+ fieldName +'], textarea[name='+ fieldName +']');
        },

        issetRule: function(rule) {
            return (Submiter.ValidatorSettings.rules).indexOf(rule) >= 0;
        },

        addField: function(fieldName) {
            var that = this, f, mName;

            this.fields[fieldName] = f = {};

            f.methods = [];

            return {
                'ruler' : function(methodName) {
                    mName = methodName || function() { return false; }
                    f.methods.push(mName);
                },
                'addNode' : function(node) {
                    mName.node(node);
                }
            }
        },

        addError: function(field, errInfo) {

            var key = errInfo.rule;

            if (!this.errField[field]) {
                this.errField[field] = {};  
            }

            this.errField[field][key] = {};

            this.errField[field][key]['errorText'] = errInfo.errText;

            if (this.settings.errorFields && this.settings.errorFields[field]) {
                this.errField[field][key]['errorNode'] = this.settings.errorFields[field];  
            }

            if (!this.errField[field]['privileged']) {
                this.errField[field]['privileged'] = key;
            }

        },

        setErrorField: function(fieldName) {
            this.fields[fieldName]['nodeError'] = this.settings.errorFields[fieldName];
            this.fields[fieldName]['nodeError'].addClass('vadidator__err');
        },

        valid: function() {

            var value, ruler, m;
            
            this.clearData();

            for(var f in this.fields) {

                value = this.getValue(f);
                ruler = this.fields[f];
             
                if (this.fields[f].nodeError) {
                    this.fields[f].nodeError.hide();    
                }
                
                for(var i = 0; i < ruler.methods.length; i++) {

                    m = ruler.methods[i];

                    if (!m.valid(value)) {
                        this.errors += 1;
                        this.addError(f, m.getError());
                    }

                }

            }

        }

    };

    Submiter.validator.constructor = Submiter.validator;



    /**
    * Работает с правилами валидации
    */
    Submiter.RulesHandler = function(rule, lute, message) {

        this.rule = rule;
        this.lute = lute;

        this.message = message || null;

        this.getErrorText = function() {
            return this.message || Submiter.ValidatorSettings.errorTexts[this.rule];
        }

        this.valid = function(value) {
            return Submiter.ValidMethods[this.rule].apply(this.node(), [value, this.lute]);
        }

        this.format = function(text, val) {
            return text.replace("%", val);
        }

        this.getError = function() {
            return {
                'errText' : this.format(this.getErrorText(), this.lute),
                'rule'    : this.rule
            }
        }

        this.node = function(node) {

            if (node) {
                this.TNode = node;
            }

            return this.TNode;
        }

    }


    $.extend(Submiter.ValidMethods = {}, {

        /**
        * Методы валидации
        * Value   - параметр валидации
        * Element - стравниваемый элемент
        */

        required: function( value, element ) {
            return $.trim(value).length > 0;
        },

        minlength: function( value, element ) {
            var length = $.isArray( value ) ? value.length : $.trim(value).length;
            return length >= element;
        },

        maxlength: function( value, element ) {
            var length = $.isArray( value ) ? value.length : $.trim(value).length;
            return length <= element;
        },
        email: function( value, element ) {
            return /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i.test(value);
        },
        // @todo: сделать настраиваемый
        equalTo: function(value, element) {
            return value === $(element).val();
        },
        checkbox: function(value, element) {
            return this.is(':checked') === element;
        },

        // должен вернуть TRUE or FALSE, нужно настроить для ответа объектом/JSON
        remote: function(value, element) {

            if (!element.url) {
                return false;
            }

            var result = false, data = {};

            element.data = element.data || {};

            for(var i in element.data) {
                if (element.data[i].jquery) {
                    data[i] = $(element.data[i]).val();
                } else {
                    data[i] = element.data[i];
                }
            }

            $.ajax({
                url: element.url,
                type: 'POST',
                dataType: "json",
                async: false,
                data: data,
                success: function(resp) {
                    
                    if (resp) {
                        result = resp.status.toUpperCase() == 'OK' ? true : false;  
                    }
                    
                    if (element.success) {
                        element.success.apply(this, [resp]);
                    }
                }
            });

            return result;
        }
    });


    $.extend(Submiter.ValidatorSettings = {}, {

        // existings rules
        rules : ['required', 'minlength', 'maxlength', 'email', 'equalTo', 'checkbox', 'remote'],

        // alarm texts
        errorTexts : {
            'required'  : 'Поле обязательно для заполнения!',
            'minlength' : 'Поле должно быть не меньше % символов',
            'maxlength' : 'Поле должно быть не больше % символов',
            'email'     : 'Введите ваш E-mail',
            'equalTo'   : 'Поле должно быть равным с %',
            'checkbox'  : 'Должно быть вслюченным',
            'remote'    : 'Test remote!'
        }

    });


    function _c(cc) {
        console.log(cc);
    }

}(jQuery, undefined));