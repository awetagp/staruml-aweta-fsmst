const codegen = require('./code-utils');
const { Location } = require('./dataset');

/**
 * Abstraction for writing StructuredText
 * By deriving this class tweaks for different platforms can be supported
 */
class CodeWriterST extends codegen.CodeWriter{

    constructor() {
        super();
    }

    toComment(comment) {
        var _comment = comment ? ` (* ${comment} *)` : '';
        // if (this.options.cstyleComment) {
        //     return `// ${comment}`;

        // }
        return _comment;
    }

    writeComment(comment) {
        if (comment) {
            this.writeLine(this.toComment(comment).trim());
        }
    }

    // FUNCTION BLOCK
    writeStateMachineBegin(name, comment) {
        this.writeLine(`FUNCTION_BLOCK FB_${name}${this.toComment(comment)}`);
        this.indent();
    }

    writeStateMachineEnd() {
        this.outdent();
        this.writeLine('END_FUNCTION_BLOCK');
    }
    // CASE
    writeCaseBegin(variable) {
        this.writeLine(`CASE ${variable} OF`);
        this.indent();
    }

    writeCaseEnd() {
        this.outdent();
        this.writeLine('END_CASE;');
    }

    writeCaseSelect(selector) {
        this.writeLine(`${selector}:`);
        this.indent();
    }

    writeCaseSelectEnd(selector) {
        this.outdent();
    }

    // IF
    writeIfBegin(condition, comment) {
        this.writeComment(comment);
        this.writeLine(`IF ${condition} THEN`);
        this.indent();
    }

    writeElseIf(condition, comment) {
        this.outdent();
        this.writeComment(comment)
        this.writeLine(`ELSIF ${condition} THEN`);
        this.indent();
    }

    writeElse(comment) {
        this.outdent();
        this.writeComment(comment)
        this.writeLine('ELSE');
        this.indent();
    }

    writeIfEnd(condition) {
        this.outdent();
        this.writeLine('END_IF;');
    }

    writeAssignment(variable, value, comment) {
        this.writeLine(`${variable} := ${value};${this.toComment(comment)}`);
    }

    writeStatement(statement, comment) {
        this.writeLine(`${statement};${this.toComment(comment)}`);
    }

    writeReturn() {
        this.writeLine('RETURN;');
    }

    writeEnumType(name, enums) {
        var me = this;
        me.writeLine('TYPE');
        me.indent();
        me.writeLine(`${name} : (`);
        me.indent();
        enums.forEach((enumValue, idx, thearay) => {
            let postfix = ',';
            if (idx === 0) {
                postfix = ' := 0,';
            }
            else if (idx === thearay.length - 1) {
                postfix = '';
            }
            me.writeLine(`${enumValue}${postfix}`);
        });
        me.outdent();
        me.writeLine(');');
        me.outdent();
        me.writeLine('END_TYPE');
    }

    writeVariables(symbolKind, variables) {
        var me = this;
        var VARLUT = {
            // Location.Var: "VAR",
            // Location.VarIn: "VAR_INPUT",
            // Location.VarOut: "VAR_OUTPUT",
            // Location.VarInOut: "VAR_INOUT",
            // Location.VarConst: "VAR CONSTANT"
        };
        VARLUT[Location.Var] = "VAR";
        VARLUT[Location.VarIn] = "VAR_INPUT";
        VARLUT[Location.VarOut] = "VAR_OUTPUT";
        VARLUT[Location.VarInOut] = "VAR_INOUT";
        VARLUT[Location.VarConst] = "VAR CONSTANT";

        if (variables.length >= 1) {
            me.writeLine(VARLUT[symbolKind]);
            me.indent();
            variables.forEach(variable => {
                let defaultValue = variable.defaultValue ? ` := ${variable.defaultValue}` : '';
                if (Array.isArray(variable.defaultValue)) {
                    me.writeLine(`${variable.name} : ${variable.datatype} := [`);
                    me.indent()
                    variable.defaultValue.forEach((v,idx,thearay) => {
                        let postfix = ', ';
                        if (idx === thearay.length - 1) {
                            postfix = '';
                        }
                        me.writeLine(`'${v}'${postfix}`);
                    })
                    me.outdent()
                    me.writeLine(`];`);
                }  else {
                    me.writeLine(`${variable.name} : ${variable.datatype}${defaultValue};${me.toComment(variable.comment)}`);
                }
            });
            me.outdent();
            me.writeLine('END_VAR');
            me.writeLine();
        }
    }
}

exports.CodeWriterST = CodeWriterST
