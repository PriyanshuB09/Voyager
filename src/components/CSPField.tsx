import React, {useEffect, useState, useRef} from 'react';
import { useEntry } from '@frc-web-components/react';

const reefscapeImageDimensions = {
    length: 800,
    width: 369
}

const reefscapeFieldDimensionsInMeters = {
    length: 16.48,
    width: 8.13
}


interface Pose2d {
    x: number;        // meters
    y: number;        // meters
    rotation: number; // radians
}


const CSPField: React.FC<{robotPose: Pose2d, robotDimensions: {length: number, width: number}, downScale?: number}> = ({robotPose, robotDimensions={length: 0.5, width: 0.5}, downScale=1}) => {

    let correctedPose = {
        length: reefscapeImageDimensions.length / reefscapeFieldDimensionsInMeters.length,
        width: reefscapeImageDimensions.width / reefscapeFieldDimensionsInMeters.width
    }

    return (
        <div style={{position: 'relative'}}>
            <img src="../../../assets/images/reefscape-field-crop.png" style={{width: `${reefscapeImageDimensions.length * downScale}px`, transform: 'scaleX(-1)'}}/>
            <div style={{fontSize: 25 * downScale, 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                textAlign: 'center', 
                alignContent: 'center', 
                boxSizing: 'border-box', 
                padding: 'auto', 
                color: 'white', 
                width: robotDimensions.length * correctedPose.length * downScale, 
                height: robotDimensions.width * correctedPose.width * downScale, 
                rotate: `${robotPose.rotation * 180 / Math.PI + 180}deg`, 
                backgroundColor: 'black', position: 'absolute', 
                top: correctedPose.width * robotPose.y * downScale, 
                left: (800 - correctedPose.length * robotPose.x) * downScale
                }}>▶</div>
        </div>
    );
}

export default CSPField;