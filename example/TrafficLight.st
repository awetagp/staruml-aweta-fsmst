TYPE
    E_TrafficLight_States: (
        TrafficLight_InActive := 0,
        TrafficLight_Init_Uzk,
        TrafficLight_Operational,
        TrafficLight_Red,
        TrafficLight_Amber,
        TrafficLight_Green,
        TrafficLight_Init_uEY,
        TrafficLight_InError
    );
END_TYPE

FUNCTION_BLOCK FB_TrafficLight
    VAR_INPUT
        ResetStateMachine: BOOL := FALSE; (* Used for testing purposes *)
        system_error: BOOL;
        system_restart: BOOL;
    END_VAR

    VAR_OUTPUT
        AmberLight: BOOL;
        GreenLight: BOOL;
        eOperationalR0State: E_TrafficLight_States := E_TrafficLight_States.TrafficLight_InActive;
        eState: E_TrafficLight_States := E_TrafficLight_States.TrafficLight_Init_Uzk;
    END_VAR

    VAR_IN_OUT
        RedLight: BOOL;
    END_VAR

    VAR
        eOperationalR0PrevState: E_TrafficLight_States := E_TrafficLight_States.TrafficLight_InActive;
        ePrevState: E_TrafficLight_States := E_TrafficLight_States.TrafficLight_InActive;
        rtAmberTimeout: R_TRIG;
        rtFlashTimeout: R_TRIG;
        rtGreenTimeout: R_TRIG;
        rtRedTimeout: R_TRIG;
        rtResetStateMachine: R_TRIG;
        rtsystem_error: R_TRIG;
        rtsystem_restart: R_TRIG;
        tonAmberTimeout: TON;
        tonFlashTimeout: TON;
        tonGreenTimeout: TON;
        tonRedTimeout: TON;
    END_VAR

    VAR CONSTANT
        StateNames: ARRAY[0..7] OF STRING := [
            'InActive',
            'Init_Uzk',
            'Operational',
            'Red',
            'Amber',
            'Green',
            'Init_uEY',
            'InError'
        ];
    END_VAR


    rtResetStateMachine(CLK := ResetStateMachine);
    IF rtResetStateMachine.Q THEN
        eState := E_TrafficLight_States.TrafficLight_Init_Uzk;
        ePrevState := E_TrafficLight_States.TrafficLight_InActive;
        eOperationalR0State := E_TrafficLight_States.TrafficLight_InActive;
        eOperationalR0PrevState := E_TrafficLight_States.TrafficLight_InActive;
        RETURN;
    END_IF;

    tonFlashTimeout();
    rtFlashTimeout(CLK := tonFlashTimeout.Q);
    tonRedTimeout();
    rtRedTimeout(CLK := tonRedTimeout.Q);
    tonGreenTimeout();
    rtGreenTimeout(CLK := tonGreenTimeout.Q);
    tonAmberTimeout();
    rtAmberTimeout(CLK := tonAmberTimeout.Q);
    rtsystem_error(CLK := system_error);
    rtsystem_restart(CLK := system_restart);
    CASE eState OF
        E_TrafficLight_States.TrafficLight_Init_Uzk:
            ePrevState := eState;

            (* AAAAAAGQFiLV9ESveYo= *)
            eState := E_TrafficLight_States.TrafficLight_Operational;
            eOperationalR0State := E_TrafficLight_States.TrafficLight_Init_uEY;
            eOperationalR0PrevState := E_TrafficLight_States.TrafficLight_InActive;

        E_TrafficLight_States.TrafficLight_Operational:
            ePrevState := eState;


        E_TrafficLight_States.TrafficLight_InError:
            IF eState <> ePrevState THEN
                (* entryActivities: *)
                tonFlashTimeout(PT := DINT_TO_TIME(undefined), IN := TRUE);
            END_IF;
            ePrevState := eState;

            IF rtsystem_restart.Q THEN
                (* AAAAAAGQFiMeOkTS0Uw= *)
                (* exitActivities: *)
                tonFlashTimeout(IN := FALSE);
                eState := E_TrafficLight_States.TrafficLight_Operational;
                eOperationalR0State := E_TrafficLight_States.TrafficLight_Init_uEY;
                eOperationalR0PrevState := E_TrafficLight_States.TrafficLight_InActive;
            ELSIF rtFlashTimeout.Q THEN
                (* AAAAAAGQFjIIb0Y4AT8= *)
                IF RedLight = TRUE THEN
                    (* effects stuff *)
                    RedLight := FALSE;
                    eState := E_TrafficLight_States.TrafficLight_InError;
                (* AAAAAAGQFjV03kZcyjE= *)
                ELSIF RedLight = FALSE THEN
                    (* effects stuff *)
                    RedLight := TRUE;
                    eState := E_TrafficLight_States.TrafficLight_InError;
                END_IF;
            END_IF;

    END_CASE;

    IF eState = E_TrafficLight_States.TrafficLight_Operational AND eState = ePrevState THEN
        CASE eOperationalR0State OF
            (* Substate TrafficLight_Operational.E_TrafficLight_States.TrafficLight_Red *)
            E_TrafficLight_States.TrafficLight_Red:
                IF eOperationalR0State <> eOperationalR0PrevState THEN
                    (* entryActivities: *)
                    RedLight := TRUE;
                    tonRedTimeout(PT := DINT_TO_TIME(undefined), IN := TRUE);
                END_IF;
                eOperationalR0PrevState := eOperationalR0State;

                IF rtsystem_error.Q THEN
                    (* AAAAAAGQFiL5r0TAnTM= *)
                    (* exitActivities: *)
                    RedLight := FALSE;
                    tonRedTimeout(IN := FALSE);
                    eState := E_TrafficLight_States.TrafficLight_InError;
                    eOperationalR0State := E_TrafficLight_States.TrafficLight_InActive;
                ELSIF rtRedTimeout.Q THEN
                    (* AAAAAAGQFiTZ4EWJFkU= *)
                    (* exitActivities: *)
                    RedLight := FALSE;
                    tonRedTimeout(IN := FALSE);
                    eOperationalR0State := E_TrafficLight_States.TrafficLight_Green;
                END_IF;

            (* Substate TrafficLight_Operational.E_TrafficLight_States.TrafficLight_Amber *)
            E_TrafficLight_States.TrafficLight_Amber:
                IF eOperationalR0State <> eOperationalR0PrevState THEN
                    (* entryActivities: *)
                    AmberLight := TRUE;
                    tonAmberTimeout(PT := DINT_TO_TIME(undefined), IN := TRUE);
                END_IF;
                eOperationalR0PrevState := eOperationalR0State;

                IF rtsystem_error.Q THEN
                    (* AAAAAAGQFiL5r0TAnTM= *)
                    (* exitActivities: *)
                    AmberLight := FALSE;
                    tonAmberTimeout(IN := FALSE);
                    eState := E_TrafficLight_States.TrafficLight_InError;
                    eOperationalR0State := E_TrafficLight_States.TrafficLight_InActive;
                ELSIF rtAmberTimeout.Q THEN
                    (* AAAAAAGQFiUTgkW83l0= *)
                    (* exitActivities: *)
                    AmberLight := FALSE;
                    tonAmberTimeout(IN := FALSE);
                    eOperationalR0State := E_TrafficLight_States.TrafficLight_Red;
                END_IF;

            (* Substate TrafficLight_Operational.E_TrafficLight_States.TrafficLight_Green *)
            E_TrafficLight_States.TrafficLight_Green:
                IF eOperationalR0State <> eOperationalR0PrevState THEN
                    (* entryActivities: *)
                    GreenLight := TRUE;
                    tonGreenTimeout(PT := DINT_TO_TIME(undefined), IN := TRUE);
                END_IF;
                eOperationalR0PrevState := eOperationalR0State;

                IF rtsystem_error.Q THEN
                    (* AAAAAAGQFiL5r0TAnTM= *)
                    (* exitActivities: *)
                    GreenLight := FALSE;
                    tonGreenTimeout(IN := FALSE);
                    eState := E_TrafficLight_States.TrafficLight_InError;
                    eOperationalR0State := E_TrafficLight_States.TrafficLight_InActive;
                ELSIF rtGreenTimeout.Q THEN
                    (* AAAAAAGQFiT+JUWrUxY= *)
                    (* exitActivities: *)
                    GreenLight := FALSE;
                    tonGreenTimeout(IN := FALSE);
                    eOperationalR0State := E_TrafficLight_States.TrafficLight_Amber;
                ELSE
                    (* AAAAAAGQFiTtTkWaogk= *)
                    (* exitActivities: *)
                    GreenLight := FALSE;
                    tonGreenTimeout(IN := FALSE);
                    eOperationalR0State := E_TrafficLight_States.TrafficLight_Amber;
                END_IF;

            (* Substate TrafficLight_Operational.E_TrafficLight_States.TrafficLight_Init_uEY *)
            E_TrafficLight_States.TrafficLight_Init_uEY:
                eOperationalR0PrevState := eOperationalR0State;

                IF rtsystem_error.Q THEN
                    (* AAAAAAGQFiL5r0TAnTM= *)
                    eState := E_TrafficLight_States.TrafficLight_InError;
                    eOperationalR0State := E_TrafficLight_States.TrafficLight_InActive;
                ELSE
                    (* AAAAAAGQFiTKBkV4waI= *)
                    eOperationalR0State := E_TrafficLight_States.TrafficLight_Red;
                END_IF;

        END_CASE;
    END_IF;
END_FUNCTION_BLOCK
