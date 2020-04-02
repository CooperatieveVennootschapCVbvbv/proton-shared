import { c } from 'ttag';
import { OpenPGPKey, serverTime } from 'pmcrypto';
import { extractDraftMIMEType, extractScheme, extractSign } from '../api/helpers/mailSettings';
import { DRAFT_MIME_TYPES, KEY_FLAGS, PGP_SCHEMES, RECIPIENT_TYPES } from '../constants';
import { toBitMap } from '../helpers/object';
import { normalize } from '../helpers/string';
import { ApiKeysConfig, PublicKeyConfigs, PublicKeyModel } from '../interfaces/Key';

const { TYPE_INTERNAL } = RECIPIENT_TYPES;
const { ENABLE_ENCRYPTION } = KEY_FLAGS;

/**
 * Check if some API key data belongs to an internal user
 */
export const getIsInternalUser = ({ RecipientType }: ApiKeysConfig): boolean => RecipientType === TYPE_INTERNAL;

/**
 * Test if no key is enabled
 */
export const isDisabledUser = (config: ApiKeysConfig): boolean =>
    getIsInternalUser(config) && !config.Keys.some(({ Flags }) => Flags & ENABLE_ENCRYPTION);

export const getEmailMismatchWarning = (publicKey: OpenPGPKey, emailAddress: string): string[] => {
    const users = publicKey.users || [];
    const keyEmails = users.reduce<string[]>((acc, { userId = {} } = {}) => {
        if (!userId?.userid) {
            // userId can be set to null
            return acc;
        }
        const [, email = userId.userid] = /<([^>]*)>/.exec(userId.userid) || [];
        // normalize the email
        acc.push(normalize(email));
        return acc;
    }, []);
    if (!keyEmails.includes(emailAddress)) {
        const keyUserIds = keyEmails.join(', ');
        return [c('Warning').t`Email address not found among user ids defined in sending key (${keyUserIds})`];
    }
    return [];
};

/**
 * Sort list of keys retrieved from the API. Trusted keys take preference.
 * For two keys such that both are either trusted or not, non-verify-only keys take preference
 */
export const sortApiKeys = (
    keys: OpenPGPKey[] = [],
    trustedFingerprints: Set<string>,
    verifyOnlyFingerprints: Set<string>
): OpenPGPKey[] =>
    keys
        .reduce<OpenPGPKey[][]>(
            (acc, key) => {
                const fingerprint = key.getFingerprint();
                // calculate order through a bitmap
                const index = toBitMap({
                    isVerificationOnly: verifyOnlyFingerprints.has(fingerprint),
                    isNotTrusted: !trustedFingerprints.has(fingerprint)
                });
                acc[index].push(key);
                return acc;
            },
            Array.from({ length: 4 }).map(() => [])
        )
        .flat();

/**
 * Sort list of pinned keys retrieved from the API. Keys that can be used for sending take preference
 */
export const sortPinnedKeys = (
    keys: OpenPGPKey[] = [],
    expiredFingerprints: Set<string>,
    revokedFingerprints: Set<string>
): OpenPGPKey[] =>
    keys
        .reduce<OpenPGPKey[][]>(
            (acc, key) => {
                const fingerprint = key.getFingerprint();
                // calculate order through a bitmap
                const index = toBitMap({
                    cannotSend: expiredFingerprints.has(fingerprint) || revokedFingerprints.has(fingerprint)
                });
                acc[index].push(key);
                return acc;
            },
            Array.from({ length: 2 }).map(() => [])
        )
        .flat();

/**
 * Given a public key, return its expiration and revoke status
 */
export const getKeyEncryptStatus = async (
    publicKey: OpenPGPKey,
    timestamp?: number
): Promise<{
    isExpired: boolean;
    isRevoked: boolean;
}> => {
    const now = timestamp || +serverTime();
    const creationTime = +publicKey.getCreationTime();
    // notice there are different expiration times depending on the use of the key.
    const expirationTime = await publicKey.getExpirationTime('encrypt');
    const isExpired = !(creationTime <= now && now <= expirationTime);
    // @ts-ignore ; OpenPGP types not up-to-date
    const isRevoked = await publicKey.isRevoked(null, null, timestamp);
    return { isExpired, isRevoked };
};

/**
 * Given a public key retrieved from the API, return true if it has been marked by the API as
 * verification-only. Return false if it's marked valid for encryption. Return undefined otherwise
 */
export const getKeyVerificationOnlyStatus = (publicKey: OpenPGPKey, config: ApiKeysConfig): boolean | undefined => {
    const fingerprint = publicKey.getFingerprint();
    const index = config.publicKeys.findIndex((publicKey) => publicKey && publicKey.getFingerprint() === fingerprint);
    if (index === -1) {
        return undefined;
    }
    return !(config.Keys[index].Flags & KEY_FLAGS.ENABLE_ENCRYPTION);
};

/**
 * For a given email address and its corresponding public keys (retrieved from the API and/or the corresponding vCard),
 * construct the public key model taking into account the user preferences in mailSettings.
 * The public key model contains information about public keys that one can use for sending email to an email address
 */
export const getPublicKeyModel = async ({
    emailAddress,
    apiKeysConfig,
    pinnedKeysConfig,
    mailSettings
}: PublicKeyConfigs): Promise<PublicKeyModel> => {
    // prepare keys retrieved from the vCard
    const {
        pinnedKeys = [],
        mimeType: vcardMimeType,
        encrypt: vcardEncrypt,
        scheme: vcardScheme,
        sign: vcardSign
    } = pinnedKeysConfig;
    const trustedFingerprints = new Set<string>();
    const expiredFingerprints = new Set<string>();
    const revokedFingerprints = new Set<string>();
    await Promise.all(
        pinnedKeys.map(async (publicKey) => {
            const fingerprint = publicKey.getFingerprint();
            const { isExpired, isRevoked } = await getKeyEncryptStatus(publicKey);
            trustedFingerprints.add(fingerprint);
            isExpired && expiredFingerprints.add(fingerprint);
            isRevoked && revokedFingerprints.add(fingerprint);
        })
    );
    const orderedPinnedKeys = sortPinnedKeys(pinnedKeys, expiredFingerprints, revokedFingerprints);

    // prepare keys retrieved from the API
    const isInternalUser = getIsInternalUser(apiKeysConfig);
    const isExternalUser = !isInternalUser;
    const verifyOnlyFingerprints = new Set<string>();
    const apiKeys = apiKeysConfig.publicKeys.filter(Boolean) as OpenPGPKey[];
    apiKeys.forEach((publicKey) => {
        if (getKeyVerificationOnlyStatus(publicKey, apiKeysConfig)) {
            verifyOnlyFingerprints.add(publicKey.getFingerprint());
        }
    });
    const orderedApiKeys = sortApiKeys(apiKeys, trustedFingerprints, verifyOnlyFingerprints);

    // Take mail settings into account
    const encrypt = !!vcardEncrypt;
    const sign = vcardSign !== undefined ? vcardSign : extractSign(mailSettings);
    const scheme = vcardScheme !== undefined ? vcardScheme : extractScheme(mailSettings);
    const mimeType = vcardMimeType !== undefined ? vcardMimeType : extractDraftMIMEType(mailSettings);
    // remember that when signing messages for external PGP users with the PGP_INLINE scheme, the email format must be plain text
    const isExternalPGPInline = sign && isExternalUser && !apiKeys.length && scheme === PGP_SCHEMES.PGP_INLINE;

    return {
        encrypt,
        sign: encrypt || sign,
        scheme,
        mimeType: isExternalPGPInline ? DRAFT_MIME_TYPES.PLAINTEXT : mimeType,
        emailAddress,
        publicKeys: { api: orderedApiKeys, pinned: orderedPinnedKeys },
        trustedFingerprints,
        expiredFingerprints,
        revokedFingerprints,
        verifyOnlyFingerprints,
        isPGPExternal: isExternalUser,
        isPGPInternal: isInternalUser,
        isPGPExternalWithWKDKeys: isExternalUser && !!apiKeys.length,
        isPGPExternalWithoutWKDKeys: isExternalUser && !apiKeys.length,
        pgpAddressDisabled: isDisabledUser(apiKeysConfig)
    };
};
