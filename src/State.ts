export enum Mode {
    PAGE1 = 'PAGE1',
    PAGE2 = 'PAGE2'
}

export interface AnimationState {
    currentMode: Mode;
    modeTimer: number;
    nextModeSwitchDuration: number;
    modeSwitchCount: number;
    isBlurred: boolean;
    blurPhase: 'STRONG' | 'NORMAL';
    blurTimer: number;
    nextBlurSwitchDuration: number;
    hasInteracted: boolean;
    interactionTarget: {
        xRadius: number;
        yRadius: number;
        rotation: number;
    };
    drift: {
        time: number;
        speed: number;
        amplitude: number;
        sizeVarAmp: number;
        curveVarAmp: number;
    };
}

export const State: AnimationState = {
    currentMode: Mode.PAGE1,
    modeTimer: 0,
    nextModeSwitchDuration: 5 + Math.random() * 5, // Min 5s
    modeSwitchCount: 0,

    isBlurred: true,
    blurPhase: 'NORMAL' as 'STRONG' | 'NORMAL',
    blurTimer: 0,
    nextBlurSwitchDuration: 8 + Math.random() * 8,

    hasInteracted: false,

    interactionTarget: {
        xRadius: 1.0,
        yRadius: 0.5,
        rotation: 6
    },

    drift: {
        time: 0,
        speed: 0.5,
        amplitude: 0.05,
        sizeVarAmp: 0.3,
        curveVarAmp: 0.3
    }
};
