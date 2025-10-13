import React, {useEffect, useState, useRef} from 'react';
import { useEntry } from '@frc-web-components/react';

const reefscapeImageDimensions = {
    length: 2924,
    width: 1348
}

const reefscapeFieldDimensionsInMeters = {
    length: 16.48,
    width: 8.13
}

const CSPField: React.FC<{robotPose: number[], robotDimensions?: {length: number, width: number}}> = ({robotPose, robotDimensions}) => {

    let correctedPose = {
        length: reefscapeImageDimensions.length / reefscapeFieldDimensionsInMeters.length,
        width: reefscapeImageDimensions.width / reefscapeFieldDimensionsInMeters.width
    }

    return (
        <div style={{position: 'relative'}}>
            <img src="../../../assets/images/reefscape-field-crop.png" style={{width: '50vw'}}/>
            <div style={{width: 25, height: 25, rotate: '20deg', backgroundColor: 'black', position: 'absolute', top: correctedPose.width * robotPose[0] , left: correctedPose.length * robotPose[1]}}></div>
        </div>
    );
}

export default CSPField;