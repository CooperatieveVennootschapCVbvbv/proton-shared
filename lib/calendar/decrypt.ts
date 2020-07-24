import {
    createCleartextMessage,
    decryptMessage,
    decryptSessionKey,
    getMessage,
    getSignature,
    OpenPGPKey,
    SessionKey,
    VERIFICATION_STATUS,
    verifyMessage,
} from 'pmcrypto';

import { deserializeUint8Array } from '../helpers/serialization';
import { SimpleMap } from '../interfaces/utils';
import { CALENDAR_CARD_TYPE } from './constants';
import { CalendarEventData, CalendarEventDataMap } from '../interfaces/calendar';

export const getDecryptedSessionKey = async (data: Uint8Array, privateKeys: OpenPGPKey | OpenPGPKey[]) => {
    return decryptSessionKey({ message: await getMessage(data), privateKeys });
};

export const verifySignedCard = async (
    dataToVerify: string,
    signature: string,
    publicKeys: OpenPGPKey | OpenPGPKey[]
) => {
    const { verified } = await verifyMessage({
        message: await createCleartextMessage(dataToVerify),
        publicKeys,
        signature: await getSignature(signature),
        detached: true,
    });

    if (verified !== VERIFICATION_STATUS.SIGNED_AND_VALID) {
        const error = new Error('Signature verification failed');
        error.name = 'SignatureError';
        throw error;
    }

    return dataToVerify;
};

export const decryptCard = async (
    dataToDecrypt: Uint8Array,
    signature: string,
    publicKeys: OpenPGPKey | OpenPGPKey[],
    sessionKey?: SessionKey
) => {
    const { data: decryptedData, verified } = await decryptMessage({
        message: await getMessage(dataToDecrypt),
        publicKeys,
        signature: await getSignature(signature),
        sessionKeys: sessionKey ? [sessionKey] : undefined,
    });

    if (verified !== VERIFICATION_STATUS.SIGNED_AND_VALID) {
        const error = new Error('Signature verification failed');
        error.name = 'SignatureError';
        throw error;
    }

    if (typeof decryptedData !== 'string') {
        throw new Error('Unknown data');
    }

    return decryptedData;
};

export const decryptAndVerifyPart = (
    {
        [CALENDAR_CARD_TYPE.SIGNED]: signed,
        [CALENDAR_CARD_TYPE.ENCRYPTED_AND_SIGNED]: encryptedAndSigned,
    }: CalendarEventDataMap,
    publicKeys: OpenPGPKey | OpenPGPKey[],
    sessionKey: SessionKey | undefined
) => {
    return Promise.all([
        signed && verifySignedCard(signed.Data, signed.Signature, publicKeys),
        encryptedAndSigned &&
            decryptCard(
                deserializeUint8Array(encryptedAndSigned.Data),
                encryptedAndSigned.Signature,
                publicKeys,
                sessionKey
            ),
    ]);
};

export const decryptAndVerifyCalendarEvent = (
    { Type, Data, Signature, Author }: CalendarEventData,
    mapPublicKeys: SimpleMap<OpenPGPKey | OpenPGPKey[]>,
    sessionKey: SessionKey | undefined
) => {
    const publicKeys = mapPublicKeys[Author] || [];
    if (Type === CALENDAR_CARD_TYPE.SIGNED) {
        return verifySignedCard(Data, Signature, publicKeys);
    }
    if (Type === CALENDAR_CARD_TYPE.ENCRYPTED_AND_SIGNED) {
        return decryptCard(deserializeUint8Array(Data), Signature, publicKeys, sessionKey);
    }
};
