StarUML extension AWETA FSMST  <!-- omit in toc -->
====

- [1. Introduction](#1-introduction)
- [2. Installation](#2-installation)
  - [2.1. For Windows](#21-for-windows)
- [3. Features](#3-features)
- [4. Supported StarUML statemachine elements](#4-supported-staruml-statemachine-elements)
- [5. Command-line:](#5-command-line)
- [6. Implementation of the StateMachine with structured text](#6-implementation-of-the-statemachine-with-structured-text)
- [7. Testing](#7-testing)


# 1. Introduction

FSMST is an [StarUML](https://staruml.io/) extension that generates IEC 61131-3Structered Text of a StarUML StateMachine diagram.
The generated output is Finite-state machine in the form of a `Function Block`.

The generates is intended to be used as generated, please don't make changes to the generated code! This makes it possible to update your statemachine and reasy reploy the update Function Block.

# 2. Installation
The extension is tested with StarUML version 6.1.1.
Follow the StarUML guideline for installing extensions.

## 2.1. For Windows
Copy the extension directory to:
```
C:/Users/${env.USERNAME}/AppData/Roaming/StarUML/extensions/user
```

Or run the `ant` with as target install :
```
ant install
```

# 3. Features

* Extension for StarUML:
  * From the GUI (Tools Menu or key combination CTRL+W)
  * As from the command-line (documenation below)
* Validator for StateMachines (are the FSMs generatable)
* Generate a finite-state machine in structured text based on StarUML statemachine diagram.
* Support for both composite and parallel (join and fork) substatemachines.
* Restore history for composite statemachines.
* Special methods available to use in effects and activities:
  * Start/Stop timers
  * Set and Reset bool
  * Put and get numbers
  * Test is bool is set and reset
  * By using the special functions in the statemachine, variable for the function block are automaticly extracted. See [Symbol Extraction](SYMBOLEXTRACTION.MD) for more information.
* A state name only has to be unqiue with in single UMLRegion (Each composite statemachine contains itw own regions).
* Direct support for timers
* For testing purpose; Input to reset entire statemachine.
* Current supported targets:
  * Generic ST - one big strucutred text file is generated
  * B&R ST - output is split in tree;  .type .fun, and .st
  * Siemens SCL - Slightly adapt to the differences between ST and SCL

# 4. Supported StarUML statemachine elements

* Basic:
  * Simple State
  * Initial State
  * Final State
  * Choice
  * Transition
  * Self Transition
* Advanced:
  * Composite State with multiple regions (parallel substatemachines)
  * Join
  * Fork
  * Shallow History

When from a self transition the property `kind` is set to `internal`, the entry and exit activities are not triggered.

*Be very carefull that the in StartUML not only the diagram matches the hierarchy but also in the model tree.
It is very easy to make a mistake with Composite state!*





# 5. Command-line:

StartUML supports running commands from the command-line with the `exec` argument.
The FSMST extension supplies the following commands  for this purpose.
* `fsm_st:generate` - generate FSM code
* `fsm_st:validate` - validate FSM

```
staruml exec -a "s=@UMLStateMachine[name=StateMachine1]" [-a m=1] [-a "o=out/<%=element.name%>.st"] <projectfile.mdj> -c fsm_st:generate
staruml exec -a 's=@UMLStateMachine[name=StateMachine1]' <projectfile.mdj> -c fsm_st:validate
s = element selector(should be statemachines)
m = generate multiple files(type, fun ,and st) per statemachine
o = outputfile location and naming
```

Example to generate a single structured text file per statemachine in the project in the directory `out`:
```powershell
Set-Alias -Name staruml -Value 'C:\Program Files\StarUML\StarUML.exe'
staruml exec -a 'm=0' .\your_project_statemachine.mdj -c fsm_st:cligenerate
```


Example to generate a single structured text file for the statemachine named `StateMachine1` in the project in the directory `out`:
```powershell
Set-Alias -Name staruml -Value 'C:\Program Files\StarUML\StarUML.exe'
staruml exec -a 'm=0' -a 's=@UMLStateMachine[name=StateMachine1]'.\your_project_statemachine.mdj -c fsm_st:cligenerate
```

# 6. Implementation of the StateMachine with structured text

The StateMachine is generated from a StartUML statemachine without manually intervention.
The StateMachine is implemented as function block. The interface of the state machine is generated based on symbol used as trigger, guards, effects and activities.

The body of the statemachine exist at least out of one CASE statement for the top level statemachine.
For each composite state a separate CASE statement is generated.

When the target platform supports enums, a type is generated with a entry for each state.
Else just const are used.
Normally the statenam in the code is the statemachine name + state name. When this name is to long the statemachine name can be replaced by setting the tag `fsm_prefix` of the StateMachine model in StarUML.

The trigger events are always a `bool`. The raising edge of each input is used as internal trigger, by creating a `R_TRIG`.
See  [Symbol Extraction](SYMBOLEXTRACTION.MD) how the correct variable type is extracted and effects/activities should be used.

# 7. Testing

The are two example projects:
* example_statemachine.mdj - several statemachines to check correct generating of code.
* example_invalid_statemachine.mdj - used to check detection of the validator.

To make it possible to see if changes to generator affects the generated code, the output of example_statemachine.mdj is also checked-in.

The ant build file contains several targets fot generating or checking the statemachines
* checkvaildationall - checks statemachines from example_statemachine.mdj
* genvalidationoutput - generate statemachines from example_statemachine.mdj
* checkvalidation - checks statemachine from example_invalid_statemachine.mdj
* install just install the extension code on the location where StarUML expect it.
