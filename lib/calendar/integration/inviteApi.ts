import { CreateCalendarEventSyncData, syncMultipleEvents, UpdateCalendarEventSyncData } from '../../api/calendars';
import { API_CODES } from '../../constants';
import { pick } from '../../helpers/object';
import { Api } from '../../interfaces';
import { CalendarEvent, CalendarWidgetData, Participant, SyncMultipleApiResponse } from '../../interfaces/calendar';
import { VcalVeventComponent } from '../../interfaces/calendar/VcalModel';
import { modifyAttendeesPartstat, withPmAttendees } from '../attendees';
import { ICAL_ATTENDEE_STATUS } from '../constants';
import { createCalendarEvent } from '../serialize';
import { getHasAttendee } from '../vcalHelper';
import getCreationKeys from './getCreationKeys';
import { findAttendee, getInvitedEventWithAlarms } from './invite';

export const createCalendarEventFromInvitation = async ({
    vevent,
    attendee,
    organizer,
    partstat,
    api,
    calendarData,
}: {
    vevent: VcalVeventComponent;
    attendee: Participant;
    organizer: Participant;
    partstat: ICAL_ATTENDEE_STATUS;
    calendarData?: CalendarWidgetData;
    api: Api;
}) => {
    const { calendar, memberID, addressKeys, calendarKeys, calendarSettings } = calendarData || {};
    if (!attendee.addressID || !calendar || !memberID || !addressKeys || !calendarKeys || !calendarSettings) {
        throw new Error('Missing data for creating calendar event from invitation');
    }
    // save attendee answer
    const vcalAttendee = attendee.vcalComponent;
    const vcalAttendeeToSave = {
        ...vcalAttendee,
        parameters: {
            ...vcalAttendee.parameters,
            partstat,
        },
    };
    const attendeeToSave = {
        ...attendee,
        vcalComponent: vcalAttendeeToSave,
        partstat,
    };
    // add alarms to event if necessary
    const veventToSave = getInvitedEventWithAlarms(vevent, partstat, calendarSettings);
    const { index: attendeeIndex } = findAttendee(attendee.emailAddress, veventToSave.attendee);
    if (!veventToSave.attendee || attendeeIndex === undefined || attendeeIndex === -1) {
        throw new Error('Missing data for creating calendar event from invitation');
    }
    veventToSave.attendee[attendeeIndex] = vcalAttendeeToSave;
    const veventToSaveWithPmAttendees = await withPmAttendees(veventToSave, api);
    // create calendar event
    const data = await createCalendarEvent({
        eventComponent: veventToSaveWithPmAttendees,
        isSwitchCalendar: false,
        ...(await getCreationKeys({ addressKeys, newCalendarKeys: calendarKeys })),
    });
    const Events: CreateCalendarEventSyncData[] = [{ Overwrite: 1, Event: { Permissions: 3, ...data } }];
    const {
        Responses: [
            {
                Response: { Code, Event },
            },
        ],
    } = await api<SyncMultipleApiResponse>({
        ...syncMultipleEvents(calendar.ID, { MemberID: memberID, Events, IsInvite: 1 }),
        silence: true,
    });
    if (Code !== API_CODES.SINGLE_SUCCESS || !Event) {
        throw new Error('Creating calendar event from invitation failed');
    }
    return {
        savedEvent: Event,
        savedVevent: veventToSaveWithPmAttendees,
        savedAttendee: attendeeToSave,
        savedOrganizer: organizer,
    };
};

export const updateCalendarEventFromInvitation = async ({
    veventApi,
    calendarEvent,
    veventIcs,
    attendee,
    organizer,
    partstat,
    oldPartstat,
    api,
    calendarData,
}: {
    veventApi: VcalVeventComponent;
    calendarEvent: CalendarEvent;
    veventIcs?: VcalVeventComponent;
    attendee: Participant;
    organizer: Participant;
    partstat: ICAL_ATTENDEE_STATUS;
    oldPartstat?: ICAL_ATTENDEE_STATUS;
    calendarData?: CalendarWidgetData;
    api: Api;
}) => {
    const { calendar, memberID, addressKeys, calendarKeys, calendarSettings } = calendarData || {};
    if (
        !getHasAttendee(veventApi) ||
        (veventIcs && !getHasAttendee(veventIcs)) ||
        !calendar ||
        !memberID ||
        !addressKeys ||
        !calendarKeys ||
        !calendarSettings
    ) {
        throw new Error('Missing data for updating calendar event from invitation');
    }
    const { vcalComponent: vcalAttendee, emailAddress } = attendee;
    const veventToUpdate = veventIcs ? { ...veventIcs, ...pick(veventApi, ['components']) } : { ...veventApi };
    const updatedVevent = {
        ...veventToUpdate,
        attendee: modifyAttendeesPartstat(veventToUpdate.attendee, { [emailAddress]: partstat }),
    };
    // add alarms to event if necessary
    const veventToSave = getInvitedEventWithAlarms(updatedVevent, partstat, calendarSettings, oldPartstat);
    const veventWithPmAttendees = await withPmAttendees(veventToSave, api);
    const vcalAttendeeToSave = {
        ...vcalAttendee,
        parameters: { ...vcalAttendee.parameters, partstat },
    };
    const attendeeToSave = {
        ...attendee,
        vcalComponent: vcalAttendeeToSave,
        partstat,
    };
    // update calendar event
    const creationKeys = await getCreationKeys({
        Event: calendarEvent,
        addressKeys,
        newCalendarKeys: calendarKeys,
    });
    const data = await createCalendarEvent({
        eventComponent: veventWithPmAttendees,
        isSwitchCalendar: false,
        ...creationKeys,
    });
    const Events: UpdateCalendarEventSyncData[] = [{ Event: { Permissions: 3, ...data }, ID: calendarEvent.ID }];
    const {
        Responses: [
            {
                Response: { Code, Event },
            },
        ],
    } = await api<SyncMultipleApiResponse>({
        ...syncMultipleEvents(calendar.ID, { MemberID: memberID, Events }),
        silence: true,
    });
    if (Code !== API_CODES.SINGLE_SUCCESS || !Event) {
        throw new Error('Updating calendar event from invitation failed');
    }
    return {
        savedEvent: Event,
        savedVevent: veventToSave,
        savedAttendee: attendeeToSave,
        savedOrganizer: organizer,
    };
};
