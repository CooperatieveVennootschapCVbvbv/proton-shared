import { ADDRESS_STATUS, ADDRESS_TYPE, RECEIVE_ADDRESS, SEND_ADDRESS, MAJOR_DOMAINS } from '../constants';
import { Address, Recipient } from '../interfaces';
import { ContactEmail } from '../interfaces/contacts';

export const getActiveAddresses = (addresses: Address[]): Address[] => {
    return addresses.filter(({ Status, Receive, Send }) => {
        return (
            Status === ADDRESS_STATUS.STATUS_ENABLED &&
            Receive === RECEIVE_ADDRESS.RECEIVE_YES &&
            Send === SEND_ADDRESS.SEND_YES
        );
    });
};

export const hasAddresses = (addresses: Address[] | undefined): boolean => {
    return Array.isArray(addresses) && addresses.length > 0;
};

export const getHasOnlyExternalAddresses = (addresses: Address[]) => {
    return addresses.every(({ Type }) => Type === ADDRESS_TYPE.TYPE_EXTERNAL);
};

export const contactToRecipient = (contact: Partial<ContactEmail> = {}, groupPath?: string): Partial<Recipient> => ({
    Name: contact.Name,
    Address: contact.Email,
    ContactID: contact.ContactID,
    Group: groupPath,
});

export const majorDomainsMatcher = (inputValue: string) => {
    const [localPart, domainPart] = inputValue.split('@');
    if (!localPart || typeof domainPart !== 'string') {
        return [];
    }
    return MAJOR_DOMAINS.map((domain) => {
        const email = `${localPart}@${domain}`;
        return { Address: email, Name: email } as Recipient;
    });
};
