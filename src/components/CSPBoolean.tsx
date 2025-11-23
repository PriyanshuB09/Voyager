import React, {useEffect, useState, useRef} from 'react';
import { useEntry } from '@frc-web-components/react';


const nativeStyles = {
    container: {
        borderRadius: 10,
        display: 'flex',
        textAlign: 'center',
        flexWrap: 'wrap',
        alignContent: 'center',
        width: 200,
        height: 200,
        position: 'absolute',
        top: 150,
        right: 100
    },
    addon: {
        width: 200,
        height: 200
    },
    enabled: {
        backgroundColor: 'green',
    },
    disabled: {
        backgroundColor: 'red',
    }
}

const CSPBoolean: React.FC<{value_key: string, state: boolean, apply?: {condition: boolean, value: number | string | boolean}, styling: any}> = ({value_key, state, styling}) => {

    return (
        <div style={
            {width: 100, 
            height: 100, 
            backgroundColor: (state) ? '#2AF527' : "#F54927",
            position: 'absolute', 
            ...styling,
            display: 'flex',
            flexDirection: 'row',
            alignContent: 'center',
            textAlign: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            }}><div style={{color: 'black'}}>{value_key}</div></div>
    );
}

export default CSPBoolean;