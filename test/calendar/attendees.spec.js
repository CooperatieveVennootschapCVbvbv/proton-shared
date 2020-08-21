import { generateAttendeeToken } from '../../lib/calendar/attendees';

describe('generateAttendeeToken()', () => {
    it('should produce correct tokens', () => {
        expect(generateAttendeeToken('james@mi6.org', 'uid@proton.me')).toBe(
            'c2d3d0b4eb4ef80633f9cc7755991e79ca033016'
        );
    });
});
