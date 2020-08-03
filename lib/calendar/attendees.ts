import getRandomValues from 'get-random-values';
import { serializeUint8Array } from '../helpers/serialization';
import { Attendee } from '../interfaces/calendar';
import { VcalAttendeeProperty, VcalVeventComponent } from '../interfaces/calendar/VcalModel';
import { ATTENDEE_PERMISSIONS, ATTENDEE_STATUS_API, ICAL_ATTENDEE_STATUS } from './constants';

const generateAttendeeToken = () => {
    // we need a random base64 string with 40 characters
    const value = getRandomValues(new Uint8Array(30));
    return serializeUint8Array(value);
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
export const fromInternalAttendee = ({
    parameters: {
        'x-pm-permissions': oldPermissions = ATTENDEE_PERMISSIONS.SEE,
        'x-pm-token': oldToken = '',
        partstat,
        ...restParameters
    } = {},
    ...rest
}: VcalAttendeeProperty) => {
    const token = oldToken || generateAttendeeToken();
    return {
        attendee: {
            parameters: {
                ...restParameters,
                'x-pm-token': token,
            },
            ...rest,
        },
        clear: {
            permissions: oldPermissions,
            token,
            status: convertPartstat(partstat),
        },
    };
};

export const toInternalAttendee = (
    { attendee: attendees = [] }: Pick<VcalVeventComponent, 'attendee'>,
    clear: Attendee[] = []
) => {
    return {
        attendee: attendees.map((attendee) => {
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
        }),
    };
};
