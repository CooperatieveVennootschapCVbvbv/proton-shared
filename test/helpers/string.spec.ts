import {
    capitalize,
    getRandomString,
    getInitial,
    findLongestMatchingIndex,
    truncate,
    encodeBase64URL,
    decodeBase64URL,
    truncateMore
} from '../../lib/helpers/string';

describe('string', () => {
    describe('getRandomString', () => {
        // We mock the random generator so the test itself...
        it('should generate a random string of length 16', () => {
            const result = getRandomString(16);
            expect(result).toEqual('ABCDEFGHIJKLMNOP');
        });
    });

    describe('longest match', () => {
        it('should get the longest matching string', () => {
            const x = ['14:00', '14:30'];
            expect(findLongestMatchingIndex(x, '14')).toBe(0);
            expect(findLongestMatchingIndex(x, '14:35')).toBe(1);
            expect(findLongestMatchingIndex(x, '14:30')).toBe(1);
            expect(findLongestMatchingIndex(x, '13:35')).toBe(0);
            expect(findLongestMatchingIndex(x, '23:35')).toBe(-1);
            expect(findLongestMatchingIndex()).toBe(-1);
        });
    });

    describe('capitalize', () => {
        it('should return empty string for non-string arguments', () => {
            const cases = [0, [], {}];
            const expected = ['', '', ''];
            expect(cases.map(capitalize)).toEqual(expected);
        });
        it('should capitalize strings as expected', () => {
            const cases = ['', 'n', 'A', 'NY', 'name', 'once upon a time...'];
            const expected = ['', 'N', 'A', 'NY', 'Name', 'Once upon a time...'];
            expect(cases.map(capitalize)).toEqual(expected);
        });
    });

    describe('getInitial', () => {
        it('should handle empty parameter', () => {
            expect(getInitial()).toEqual('');
        });

        it('should handle uniq word', () => {
            expect(getInitial('熊猫')).toEqual('熊');
        });

        it('should return 2 first initials and capitalize it', () => {
            expect(getInitial('Lorem ipsum dolor sit amet')).toEqual('LI');
        });

        it('should handle emoji', () => {
            expect(getInitial('🐼')).toEqual('🐼');
        });

        it('should keep only character and number', () => {
            expect(getInitial('22 - Name')).toEqual('2N');
        });
    });

    describe('truncate', () => {
        it('should truncate', () => {
            expect(truncate('', 1)).toEqual('');
            expect(truncate('a', 1)).toEqual('a');
            expect(truncate('ab', 1)).toEqual('...');
            expect(truncate('abc', 1)).toEqual('...');
            expect(truncate('abc', 3)).toEqual('abc');
            expect(truncate('abcd', 3)).toEqual('...');
            expect(truncate('abcd', 4)).toEqual('abcd');
            expect(truncate('abcde', 4)).toEqual('a...');
            expect(truncate('abcde', 8)).toEqual('abcde');
        });
    });

    describe('truncateMore', () => {
        it('should truncate', () => {
            expect(truncateMore({ string: '', charsToDisplayStart: 1 })).toEqual('');
            expect(truncateMore({ string: 'a', charsToDisplayStart: 1 })).toEqual('a');
            expect(truncateMore({ string: 'ab', charsToDisplayStart: 1 })).toEqual('ab');
            expect(truncateMore({ string: 'abc', charsToDisplayStart: 4 })).toEqual('abc');
            expect(truncateMore({ string: 'abcd', charsToDisplayStart: 1 })).toEqual('abcd');
            expect(truncateMore({ string: 'abcde', charsToDisplayStart: 1 })).toEqual('a...');
            expect(truncateMore({ string: '', charsToDisplayEnd: 1 })).toEqual('');
            expect(truncateMore({ string: 'a', charsToDisplayEnd: 1 })).toEqual('a');
            expect(truncateMore({ string: 'ab', charsToDisplayEnd: 1 })).toEqual('ab');
            expect(truncateMore({ string: 'abc', charsToDisplayEnd: 4 })).toEqual('abc');
            expect(truncateMore({ string: 'abcd', charsToDisplayEnd: 1 })).toEqual('abcd');
            expect(truncateMore({ string: 'abcde', charsToDisplayEnd: 1 })).toEqual('...e');
            expect(truncateMore({ string: '12345', charsToDisplayStart: 2, charsToDisplayEnd: 2 })).toEqual('12345');
            expect(truncateMore({ string: '123456789', charsToDisplayStart: 2, charsToDisplayEnd: 3 })).toEqual(
                '12...789'
            );
        });
    });

    describe('encodeBase64URL', () => {
        const validChars = '_-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        const strings = ['', 'The quick brown fox jumps over the lazy dog', '@#N{}|*sdgOnf&çÇéöªº', 'foobar'];

        it('should only use valid characters', () => {
            const filterEncode = (str) =>
                encodeBase64URL(str)
                    .split('')
                    .filter((char) => validChars.includes(char))
                    .join('');
            expect(strings.map(encodeBase64URL)).toEqual(strings.map(filterEncode));
        });

        it('should roundtrip strings', () => {
            strings.forEach((string) => {
                expect(decodeBase64URL(encodeBase64URL(string))).toEqual(string);
            });
        });
    });

    describe('validateDomain', () => {
        it('should accept valid domains', () => {
            const domains = [
                'protonmail.com',
                'mail.proton.me.',
                'vpn.at.proton.me',
                'pro-ton.mail.com',
                'xn--80ak6aa92e.com',
                '_dnslink.ipfs.io',
                'n.mk',
                'a-1234567890-1234567890-1234567890-1234567890-1234567890-1234-z.eu.us',
                'external.asd1230-123.asd_internal.asd.gm-_ail.com'
            ];
            const results = domains.map((domain) => validateDomain(domain));
            const expected = domains.map(() => true);
            expect(results).toEqual(expected);
        });

        it('should reject invalid domains', () => {
            const domains = ['protonmail', '-mail.proton.me.', '1234', '[123.32]', 'pro*ton.mail.com'];
            const results = domains.map((domain) => validateDomain(domain));
            const expected = domains.map(() => false);
            expect(results).toEqual(expected);
        });
    });

    describe('validateEmailAddress', () => {
        it('should validate good email addresses', () => {
            const emails = [
                'test@protonmail.com',
                '(comment)test+test(ot@" her)@pm.me',
                'test@[192.168.1.1]',
                'test(rare)@[192.168.12.23]',
                '(comment)"te@ st"(rare)@[192.168.12.23]',
                "weird!#$%&'*+-/=?^_`{|}~123@pa-ta-Ton32.com.edu.org"
            ];
            expect(emails.map((email) => validateEmailAddress(email)).filter(Boolean).length).toBe(emails.length);
        });

        it('should not validate malformed email addresses', () => {
            const emails = [
                'hello',
                'hello.@test.com',
                'he..lo@test.com',
                '.hello@test.com',
                'test@[192.168.1.1.2]',
                'test(rare)@[19245.168.12.23]',
                'test@domain',
                'test@domain.b',
                'test@-domain.com',
                'test@domain-.com',
                'test@test@domain.com',
                'français@baguette.fr',
                'ezpaña@espain.es'
            ];
            expect(emails.map((email) => validateEmailAddress(email)).filter(Boolean).length).toBe(0);
        });
    });

    describe('normalizeEmail', () => {
        it('should lower case external emails', () => {
            const emails = ['testing@myDomain', 'TeS.--TinG@MYDOMAIN', 'ABC;;@cde', 'bad@email@this.is'];
            const expected = emails.map((email) => email.toLowerCase());
            expect(emails.map((email) => normalizeEmail(email))).toEqual(expected);
            expect(emails.map((email) => normalizeEmail(email, false))).toEqual(expected);
        });

        it('should normalize internal emails properly', () => {
            const emails = [
                'testing@pm.me',
                'TeS.--TinG@PM.ME',
                'ABC;;@pm.me',
                'mo____.-..reTes--_---ting@pm.me',
                'bad@email@this.is'
            ];
            const normalized = [
                'testing@pm.me',
                'testing@PM.ME',
                'abc;;@pm.me',
                'moretesting@pm.me',
                'bad@email@this.is'
            ];
            expect(emails.map((email) => normalizeEmail(email, true))).toEqual(normalized);
            expect(emails.map(normalizeInternalEmail)).toEqual(normalized);
        });
    });
});
