// docs : https://docs.staruml.io/developing-extensions

const path = require('path');
const fs = require('fs');
// const filenamify = require("filenamify");
// const ejs = require("ejs");


function handleFsmGenerator(template_file, elements, output) {
    // const data = {
    //     app: app,
    //     element: statemachine,
    //     // filenamify: filenamify
    // };
    if (output) {

        console.log(template_file);
        try {

            // const elements = app.repository.select(select);
            for (let i = 0; i < elements.length; i++) {

                const element = elements[i];

                const data = {
                    app: app,
                    element: element
                    // filenamify: filenamify,
                };

                const outputRendered = ejs.render(output, data, { async: false });
                console.log(outputRendered);
                var rendered = '';
                // ipcRenderer.send("console-log", `[StarUML] ${path.resolve(template_file)}`);
                ejs.renderFile(path.resolve(template_file), data, { async: false }, function (err, _rendered) {
                    rendered = _rendered

                    if (err) {
                        //ipcRenderer.send("console-log", `[StarUML] ejs err: ${err}`);
                        console.error(err);
                    }
                    else {
                    // ipcRenderer.send("console-log", `[StarUML] ejs done`);
                    }
                });
                console.log(`gen done`);
                fs.writeFileSync(outputRendered, rendered, { encoding: "utf-8" });
                console.log(`writen to ${outputRendered}`);

                    // ipcRenderer.send("console-log", `[StarUML] ${outputRendered}`);
                    // } else {
                    //   ipcRenderer.send("console-log", rendered);
                    // }
                }
                // ipcRenderer.send(
                // "console-log",
                // `[StarUML] Total ${elements.length} files were generated`,
                // );
        } catch (err) {
            // ipcRenderer.send("console-log", `[Error] ${err.toString()}`);
            console.error(err);
        }


    }
}

function handleFsmGenerate() {


    if (   app.selections.getSelectedModels().length == 1
        && app.selections.getSelectedModels()[0] instanceof type['UMLStateMachine']
    ) {
        var state_machine = app.selections.getSelectedModels()[0],
            basedir = path.dirname(app.project.filename),
            output = path.resolve(path.join(basedir, app.preferences.get('fsmst.gen.outputFormat'))),
            template_file = path.join(__dirname, 'resources', app.preferences.get("fsmst.gen.template"));
        // window.alert(`Selected statemachine ${state_machine.name}!`);


        //.\example_statemachine.mdj -t ./statemachine_fbst.ejs -s "@UMLStateMachine[name=StateMachine4]" -o "out/<%=element.name%>.st"
        console.log(basedir);

        handleFsmGenerator(template_file, [state_machine], output)
    }
    else {
        window.alert('Please select a StateMachine in the explorer!');
    }
  }

function init () {
    app.commands.register('fsm_st:generate', handleFsmGenerate)
}


exports.init = init;
