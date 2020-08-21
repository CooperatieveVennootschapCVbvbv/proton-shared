import { arrayToBinaryString, binaryStringToArray, decodeUtf8, unsafeSHA1 } from 'pmcrypto';
import { openpgp } from 'pmcrypto/lib/openpgp';
import { Attendee } from '../interfaces/calendar';
import { VcalAttendeeProperty, VcalVeventComponent } from '../interfaces/calendar/VcalModel';
import { ATTENDEE_STATUS_API, ICAL_ATTENDEE_STATUS } from './constants';

export const generateAttendeeToken = async (email: string, uid: string) => {
    const uidEmail = uid + email;
    const byteArray = binaryStringToArray(decodeUtf8(uidEmail));
    const hash = await unsafeSHA1(byteArray);
    return openpgp.util.str_to_hex(arrayToBinaryString(hash));
};

const convertPartstat = (partstat?: string) => {
    if (partstat === ICAL_ATTENDEE_STATUS.TENTATIVE) {
        return ATTENDEE_STATUS_API.TENTATIVE;
    }
    if (partstat === ICAL_ATTENDEE_STATUS.ACCEPTED) {
        return ATTENDEE_STATUS_API.ACCEPTED;
    }
    if (partstat === ICAL_ATTENDEE_STATUS.DECLINED) {
        return ATTENDEE_STATUS_API.DECLINED;
    }
    return ATTENDEE_STATUS_API.NEEDS_ACTION;
};

/**
 * Internally permissions are stored as x-pm-permissions in the vevent,
 * but stripped for the api.
 */
export const fromInternalAttendee = async (
    { parameters: { 'x-pm-token': oldToken = '', partstat, ...restParameters } = {}, ...rest }: VcalAttendeeProperty,
    component: VcalVeventComponent
) => {
    if (restParameters.cn === undefined) {
        throw new Error('Attendee information error');
    }
    const token = oldToken || (await generateAttendeeToken(restParameters.cn, component.uid.value));
    return {
        attendee: {
            parameters: {
                ...restParameters,
                'x-pm-token': token,
                rsvp: 'TRUE' as const,
            },
            ...rest,
        },
        clear: {
            token,
            status: convertPartstat(partstat),
        },
    };
};

export const toInternalAttendee = (
    { attendee: attendees = [] }: Pick<VcalVeventComponent, 'attendee'>,
    clear: Attendee[] = []
): VcalAttendeeProperty[] => {
    return attendees.map((attendee) => {
        if (!attendee.parameters) {
            return attendee;
        }
        const token = attendee.parameters['x-pm-token'];
        const extra = clear.find(({ Token }) => Token === token);
        if (!token || !extra) {
            return attendee;
        }
        return {
            ...attendee,
            parameters: {
                ...attendee.parameters,
                'x-pm-permissions': extra.Permissions,
            },
        };
    });
};
