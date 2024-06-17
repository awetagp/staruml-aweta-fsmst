// docs : https://docs.staruml.io/developing-extensions
// api: https://files.staruml.io/api-docs/6.0.0/api/index.html

const path = require('path');
const fs = require('fs');
const { ipcRenderer } = require("electron");
// const filenamify = require("filenamify");
// const ejs = require("ejs");
const extract = require('./symbolextraction').extract;


function handleFsmGenerator(template_file, elements, output) {
    var error = false;
    const file_extensions = ['.type', '.fun', '.st'];
    const file_count = app.preferences.get('fsmst.gen.splitFiles') ? 3 : 1;
    if (output) {
        console.log(template_file);

        try {
            for (let i = 0; i < elements.length; i++) {
                var  output_masker = output;
                const element = elements[i];

                // if split generate for each file part an own render
                for (let file_nr =0; file_nr < file_count; file_nr++) {
                    const data = {
                        app: app,
                        element: element,
                        dataset: extract(element),
                        render_type: file_count === 1 ? true: file_nr === 0,
                        render_fun: file_count === 1 ? true: file_nr === 1,
                        render_st: file_count === 1 ? true: file_nr === 2
                    };
                    if (file_count > 1) {
                        output_masker = output_masker.replace(/\.\w+$/, file_extensions[file_nr]);
                    }

                    const outputRendered = ejs.render(output_masker, data, { async: false });
                    console.log(outputRendered);
                    var rendered = '';
                    // ipcRenderer.send("console-log", `[StarUML] ${path.resolve(template_file)}`);
                    ejs.renderFile(path.resolve(template_file), data, { async: false }, function (err, _rendered) {
                        rendered = _rendered

                        if (err) {
                            ipcRenderer.send("console-log", `[StarUML] ejs err: ${err}`);
                            console.error(err);
                            error = true;
                        }
                        else {
                            ipcRenderer.send("console-log", `[StarUML] ejs done`);
                        }
                    });
                    if (error == false) {
                        console.log(`gen done`);
                        fs.writeFileSync(outputRendered, rendered, { encoding: "utf-8" });
                        console.log(`writen to ${outputRendered}`);
                        ipcRenderer.send("console-log", `[StarUML] ${outputRendered}`);
                    }

                    // ipcRenderer.send("console-log", `[StarUML] ${outputRendered}`);
                    // } else {
                    //   ipcRenderer.send("console-log", rendered);
                    // }
                }
                ipcRenderer.send(
                    "console-log",
                    `[StarUML] Total ${elements.length} statemachine were generated`,
                );
            };
        } catch (err) {
            ipcRenderer.send("console-log", `[Error] ${err.toString()}`);
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
                    template_file = path.join(__dirname, 'resources', app.preferences.get("fsmst.gen.template"));
                //.\example_statemachine.mdj -t ./statemachine_fbst.ejs -s "@UMLStateMachine[name=StateMachine4]" -o "out/<%=element.name%>.st"
                console.log(basedir);
                error = handleFsmGenerator(template_file, [state_machine], output);
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
function handleFsmGenerateCli(message) {
    if (message) {
        var _args = {},
            elements;
        message.forEach(arg => {
            const parts = arg.split("=", 2);
            ipcRenderer.send("console-log", arg);
            ipcRenderer.send("console-log", parts);
            _args[parts[0]] = parts[1];
        })

        ipcRenderer.send("console-log", message);
        ipcRenderer.send("console-log", _args);

        if ('s' in _args) {
            elements = app.repository.select(_args['s']);
            // ipcRenderer.send("console-log", elements);
        }

        console.log('Doei');







        ipcRenderer.send("console-log", "Done it!");
    }
}

function init () {
    app.commands.register('fsm_st:generate', handleFsmGenerate, 'FSM Generate')
    app.commands.register('fsm_st:cligenerate', handleFsmGenerateCli)
}


exports.init = init
