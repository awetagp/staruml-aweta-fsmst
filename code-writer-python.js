const codegen = require('./code-utils');
const { Location } = require('./dataset');
const { CodeWriterST } = require('./code-writer-st');

/**
 * Abstraction for writing StructuredText
 * By deriving this class tweaks for different platforms can be supported
 */
class CodeWriterPython extends codegen.CodeWriter {

    constructor() {
        super();
    }

    _fixCondition(condition) {
        return condition.replace('=', '==').replace('<>','!=').replace('FALSE', 'False').replace('TRUE','True').replace('AND','and').replace('OR','or')
    }


    toComment(comment) {
        var _comment = comment ? ` # ${comment}` : '';
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
        this.writeLine(`class fb_${name}:`);
        this.indent();
        this.writeComment(comment);
        this.writeLine();
        this.writeLine('def __init__(self):')


    }

    writeStateMachineEnd() {
        this.outdent();
        // this.writeLine('END_FUNCTION_BLOCK');
    }


    writeBodyBegin() {
        this.writeLine('def run(self) -> None:');
        this.indent();
    }

    writeBodyEnd() {
    }

    // CASE
    writeCaseBegin(variable) {
        this.writeLine(`match ${variable}:`);
        this.indent();
    }

    writeCaseEnd() {
        this.outdent();
        // this.writeLine('END_CASE;');
    }

    writeCaseSelect(selector) {
        this.writeLine(`case ${selector}:`);
        this.indent();
    }

    writeCaseSelectEnd(selector) {
        this.outdent();
    }

    // IF
    writeIfBegin(condition, comment) {
        this.writeComment(comment);
        this.writeLine(`if ${this._fixCondition(condition)}:`);
        this.indent();
    }

    writeElseIf(condition, comment) {
        this.outdent();
        this.writeComment(comment)
        this.writeLine(`elif ${this._fixCondition(condition)}:`);
        this.indent();
    }

    writeElse(comment) {
        this.outdent();
        this.writeComment(comment)
        this.writeLine('else:');
        this.indent();
    }

    writeIfEnd() {
        this.outdent();
        // this.writeLine('END_IF;');
    }

    writeAssignment(variable, value, comment) {
        this.writeComment(comment);
        this.writeLine(`${variable} = ${value}`);
    }

    writeStatement(statement, comment) {
        this.writeComment(comment);
        this.writeLine(`${statement.replace(':=', '=').replace('TRUE', 'True').replace('FALSE', 'False')}`);
    }

    writeReturn() {
        this.writeLine('return');
    }

    writeEnumType(name, enums) {
        var me = this;
        me.writeLine('from enum import IntEnum');
        me.writeLine();

        me.writeLine(`class ${name}(IntEnum) :`);
        me.indent();
        enums.forEach((enumValue, idx, thearay) => {
            let postfix = ` = ${idx}`;
            // if (idx === 0) {
            //     postfix = ' = 0';
            // }
            // else if (idx === thearay.length - 1) {
            //     postfix = '';
            // }
            me.writeLine(`${enumValue}${postfix}`);
        });
        me.outdent();
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
            me.writeComment(VARLUT[symbolKind]);
            me.indent();
            variables.forEach(variable => {
                let defaultValue = variable.defaultValue ? ` =  ${variable.defaultValue}` : '';
                if (Array.isArray(variable.defaultValue)) {
                    // me.writeLine(`${variable.name} : ${variable.datatype} := [`);
                    // me.indent()
                    // variable.defaultValue.forEach((v,idx,thearay) => {
                    //     let postfix = ', ';
                    //     if (idx === thearay.length - 1) {
                    //         postfix = '';
                    //     }
                    //     me.writeLine(`'${v}'${postfix}`);
                    // })
                    // me.outdent()
                    // me.writeLine(`];`);
                } else {
                    let dataType = variable.datatype.replace('BOOL', 'bool');
                    defaultValue = defaultValue.replace('TRUE', 'True').replace('FALSE', 'False');
                    // me.writeLine(`${variable.name} : ${variable.datatype}${defaultValue};${me.toComment(variable.comment)}`);
                    me.writeComment(variable.comment);
                    me.writeLine(`self.${variable.name} : ${dataType}${defaultValue}`);
                }
            });
            me.outdent();
            // me.writeLine('END_VAR');
            me.writeLine();
        }
    }
}

exports.CodeWriterPython = CodeWriterPython
