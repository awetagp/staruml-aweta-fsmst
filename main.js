// docs : https://docs.staruml.io/developing-extensions
// api: https://files.staruml.io/api-docs/6.0.0/api/index.html

const path = require('path');
const fs = require('fs');
const { ipcRenderer } = require("electron");
// const filenamify = require("filenamify");
// const ejs = require("ejs");
const extract = require('./symbolextraction').extract;
const codegenerator = require('./code-generator');

function handleFsmCodeGenerator(elements, output, splitfiles) {
    var error = false;
    const file_extensions = ['.typ', '.fun', '.st'];
    const file_count = splitfiles ? 3 : 1;
    if (output) {

        try {
            for (let i = 0; i < elements.length; i++) {
                var  output_masker = output;
                const element = elements[i];

                // if split generate for each file part an own render
                for (let file_nr = 0; file_nr < file_count; file_nr++) {
                    const dataset = extract(element);
                    var options = new codegenerator.StructuredTextGeneratorOptions();
                    const data = {
                        element: element,
                    };
                    options.generateType = file_count === 1 ? true : file_nr === 0,
                    options.generateVars = file_count === 1 ? true : file_nr === 1;
                    options.generateST = file_count === 1 ? true : file_nr === 2;

                    if (file_count > 1) {
                        output_masker = output_masker.replace(/\.\w+$/, file_extensions[file_nr]);
                    }

                    const outputRendered = ejs.render(output_masker, data, { async: false });
                    console.log(outputRendered);
                    var rendered = '',
                        basedir ='';

                    rendered = codegenerator.generate(element, basedir, dataset, options);

                    if (error == false) {
                        console.log(`gen done`);
                        fs.writeFileSync(outputRendered, rendered, { encoding: "utf-8" });
                        console.log(`writen to ${outputRendered}`);
                        ipcRenderer.send("console-log", `[StarUML|FSM_ST] Generated '${outputRendered}'`);
                    }

                    // ipcRenderer.send("console-log", `[StarUML] ${outputRendered}`);
                    // } else {
                    //   ipcRenderer.send("console-log", rendered);
                    // }
                }
            };
            ipcRenderer.send(
                "console-log",
                `[StarUML|FSM_ST] Total ${elements.length} statemachine(s) were generated`,
            );

        } catch (err) {
            ipcRenderer.send("console-log", `[FSM_ST|Error] ${err.toString()}`);
            console.error(err);
            error = true;
        }


    }
    return error;
}
function handleFsmGenerate() {
    app.elementPickerDialog.showDialog('Select a base model to generate codes', null, type.UMLStateMachine).then(function ({
        buttonId,
        returnValue
    }) {
        if (buttonId === 'ok') {
            if (returnValue instanceof type['UMLStateMachine']) {
                var state_machine = returnValue,
                    error;
                basedir = path.dirname(app.project.filename),
                    output = path.resolve(path.join(basedir, app.preferences.get('fsmst.gen.outputFormat'))),
                    template_file = path.join(__dirname, 'resources', app.preferences.get("fsmst.gen.template")),
                    splitFiles = app.preferences.get('fsmst.gen.splitFiles');
                //.\example_statemachine.mdj -t ./statemachine_fbst.ejs -s "@UMLStateMachine[name=StateMachine4]" -o "out/<%=element.name%>.st"
                console.log(basedir);
                error = handleFsmCodeGenerator([state_machine], output, splitFiles);
                if (error == false) {
                    if (app.preferences.get("fsmst.gen.showComplete")) {
                        app.dialogs.showInfoDialog(`Complete code generation for statemachine '${state_machine.name}'.`);
                    }
                }  else {
                    app.dialogs.showAlertDialog(`An fatal error occured during code generation for statemachine '${state_machine.name}'.`);
                }
            } else {
                app.dialogs.showInfoDialog('Please select a StateMachine!');
            }
        };
    })

}

function showUsage() {
    ipcRenderer.send("console-log", "staruml exec -a help");
    ipcRenderer.send("console-log", "staruml exec -a \"s=@UMLStateMachine[name=StateMachine1]\" [-a m=1] [-a \"o=out/<%=element.name%>.st\"] <projectfile.mdj> -c fsm_st:cligenerate");
    ipcRenderer.send("console-log", "s = element selector(should be statemachines)\nm = generate multiple files(type, fun ,and st) per statemachine\no = outputfile location and naming");
}

function handleFsmGenerateCli(message) {
    if (message) {
        var _args = {},
            basedir = path.dirname(app.project.filename),
            output = output = path.resolve(path.join(basedir, app.preferences.get('fsmst.gen.outputFormat'))),
            splitFiles = true,
            templateFile = path.join(__dirname, 'resources', app.preferences.get("fsmst.gen.template")),
            elements,
            showTheUsage = false;

        // ipcRenderer.send("console-log", message);
        if (typeof message == 'string') {
            message = [message];
        }

        message.forEach(arg => {
            if (arg == 'help' || arg == 'h') {
                showTheUsage = true;
                return;
            }
            if (arg[1] == '=') {
                _args[arg[0]] = arg.substr(2);
            }
        })

        if (showTheUsage || 'h' in _args || arguments.length===0 ) {
            showUsage();
            return;
        }


        // ipcRenderer.send("console-log", _args);

        if ('t' in _args) {
            templateFile = _args['t'];
        }
        if ('s' in _args) {
            elements = app.repository.select(_args['s']);
        }
        else {
            elements = app.repository.select('@UMLStateMachine');
        }
        if ('o' in _args) {
            output = _args['o'];
        }
        if ('m' in _args) {
            splitFiles = Boolean(Number(_args['m']));
        }


        if (elements && elements.length >= 1) {
            error = handleFsmCodeGenerator(elements, output, splitFiles);
            ipcRenderer.send("console-log", "Done it!");
        } else {
            ipcRenderer.send("console-log", "Invalid arguments!");
            showUsage();
        }
    }
}

function init () {
    app.commands.register('fsm_st:generate', handleFsmGenerate, 'FSM Generate')
    app.commands.register('fsm_st:cligenerate', handleFsmGenerateCli)
}


exports.init = init
