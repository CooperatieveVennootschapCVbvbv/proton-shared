import { OpenPGPKey } from 'pmcrypto';
import { CachedKey, KeyAction } from '../interfaces';

export interface AddKeyArguments {
    ID: string;
    flags: number;
    parsedKeys: CachedKey[];
    actionableKeys: KeyAction[];
    privateKey: OpenPGPKey;
}
export const addKeyAction = ({
    parsedKeys,
    actionableKeys,
    ID: newKeyID,
    privateKey,
    flags,
}: AddKeyArguments): KeyAction[] => {
    if (parsedKeys.find(({ Key: { ID } }) => ID === newKeyID)) {
        throw new Error('Key already exists');
    }

    const newKey: KeyAction = {
        ID: newKeyID,
        primary: !parsedKeys.length ? 1 : 0,
        flags,
        privateKey,
    };

    return [...actionableKeys, newKey];
};

export const reactivateKeyAction = ({
    parsedKeys,
    actionableKeys,
    ID: targetID,
    privateKey,
    flags,
}: AddKeyArguments): KeyAction[] => {
    const oldKey = parsedKeys.find(({ Key: { ID } }) => ID === targetID);
    if (!oldKey) {
        throw new Error('Key not found');
    }
    if (actionableKeys.find(({ ID }) => ID === targetID)) {
        throw new Error('Key already active');
    }

    const newKey: KeyAction = {
        ID: oldKey.Key.ID,
        primary: !parsedKeys.length ? 1 : 0,
        flags,
        privateKey,
    };

    return [...actionableKeys, newKey];
};

export const removeKeyAction = ({ actionableKeys, ID }: { actionableKeys: KeyAction[]; ID: string }) => {
    return actionableKeys.filter((key) => key.ID !== ID);
};

export const setPrimaryKeyAction = ({ actionableKeys, ID: targetID }: { actionableKeys: KeyAction[]; ID: string }) => {
    // Ensure it exists, can only set primary if it's decrypted
    if (!actionableKeys.find(({ ID }) => ID === targetID)) {
        throw new Error('Key not found');
    }
    return actionableKeys
        .map((key) => {
            return {
                ...key,
                primary: key.ID === targetID ? 1 : 0,
            };
        })
        .sort((a, b) => b.primary - a.primary);
};

export const setFlagsKeyAction = ({
    actionableKeys,
    ID,
    flags,
}: {
    actionableKeys: KeyAction[];
    ID: string;
    flags: number;
}): KeyAction[] => {
    return actionableKeys.map((key) => {
        if (key.ID === ID) {
            return {
                ...key,
                flags,
            };
        }
        return key;
    });
};
