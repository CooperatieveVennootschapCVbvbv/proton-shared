/**
 * Validate the local part of an email string according to the RFC https://tools.ietf.org/html/rfc5322;
 * see also https://en.wikipedia.org/wiki/Email_address#Local-part
 */
import isTruthy from './isTruthy';

export const validateLocalPart = (localPart: string) => {
    const match = localPart.match(/(^\(.+?\))?([^()]*)(\(.+?\)$)?/);
    if (!match) {
        return false;
    }
    const uncommentedPart = match[2];
    if (/".+"/.test(uncommentedPart)) {
        return true;
    }
    return !/[^a-zA-Z0-9!#$%&'*+-/=?^_`{|}~]|^\.|\.$|\.\./.test(uncommentedPart);
};

/**
 * Validate the domain of an email string according to the RFC https://tools.ietf.org/html/rfc5322;
 * see also https://en.wikipedia.org/wiki/Email_address#Domain
 */
export const validateDomain = (domain: string) => {
    if (/\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\]/.test(domain)) {
        return true;
    }
    const dnsLabels = domain.split('.');
    if (dnsLabels.length < 2) {
        return false;
    }
    const topLevelDomain = dnsLabels.pop() as string;
    if (!/[a-zA-Z]{2,}/.test(topLevelDomain)) {
        return false;
    }
    return !dnsLabels.some((label) => {
        return /[^a-zA-Z0-9-]|^-|-$/.test(label);
    });
};

/**
 * Split an email into local part plus domain.
 */
const getEmailParts = (email: string): string[] => {
    const endIdx = email.lastIndexOf('@');
    if (endIdx === -1) {
        return [email, ''];
    }
    return [email.slice(0, endIdx), email.slice(endIdx + 1)];
};

/**
 * Validate an email string according to the RFC https://tools.ietf.org/html/rfc5322;
 * see also https://en.wikipedia.org/wiki/Email_address
 */
export const validateEmailAddress = (email: string) => {
    const [localPart, domain] = getEmailParts(email);
    return validateLocalPart(localPart) && validateDomain(domain);
};

/**
 * Normalize an internal email. This is needed to compare when two internal emails should be considered equivalent
 * See documentation at https://confluence.protontech.ch/display/MAILFE/Email+normalization
 */
export const normalizeInternalEmail = (email: string) => {
    const [localPart, domain] = getEmailParts(email);
    const normalizedLocalPart = localPart.replace(/[._-]/g, '').toLowerCase();
    return `${normalizedLocalPart}@${domain}`;
};

/**
 * Normalize an external email. This is needed to compare when two external emails should be considered equivalent.
 * Basically we just check email validity
 * See documentation at https://confluence.protontech.ch/display/MAILFE/Email+normalization for more information
 */
export const normalizeExternalEmail = (email: string) => {
    const [localPart, domain] = getEmailParts(email);
    return `${localPart}@${domain}`;
};

/**
 * Normalize an email. This is needed to compare when two emails should be considered equivalent
 * See documentation at https://confluence.protontech.ch/display/MAILFE/Email+normalization
 */
export const normalizeEmail = (email: string, isInternal?: boolean) => {
    return isInternal ? normalizeInternalEmail(email) : normalizeExternalEmail(email);
};

const extractStringItems = (str: string) => {
    return str.split(',').filter(isTruthy);
};

/**
 * Extract "to address" and headers from a mailto URL https://tools.ietf.org/html/rfc6068
 * TODO: extract headers. Only "to address" extracted atm
 */
export const parseMailtoURL = (mailtoURL: string) => {
    const mailtoString = 'mailto:';
    const toString = 'to=';
    if (!mailtoURL.toLowerCase().startsWith(mailtoString)) {
        throw new Error('Malformed mailto URL');
    }
    const url = mailtoURL.substring(mailtoString.length);
    const [tos, hfields = ''] = url.split('?');
    const addressTos = extractStringItems(tos);
    const headers = hfields.split('&').filter(isTruthy);
    const headerTos = headers
        .filter((header) => header.toLowerCase().startsWith('to='))
        .map((headerTo) => extractStringItems(headerTo.substring(toString.length)))
        .flat();
    return { to: [...addressTos, ...headerTos] };
};
