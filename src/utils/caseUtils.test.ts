import { detectCase, transform, isValidCase, getAllCaseVariants, CaseType } from './caseUtils';

describe('caseUtils', () => {
  describe('detectCase', () => {
    it('should detect PascalCase', () => {
      expect(detectCase('MyComponent')).toBe('pascal');
      expect(detectCase('Button')).toBe('pascal');
      expect(detectCase('HeaderNavigation')).toBe('pascal');
    });

    it('should detect camelCase', () => {
      expect(detectCase('myComponent')).toBe('camel');
      expect(detectCase('userProfileCard')).toBe('camel');
      expect(detectCase('headerNavigation')).toBe('camel');
    });

    it('should detect kebab-case', () => {
      expect(detectCase('my-component')).toBe('kebab');
      expect(detectCase('button-group')).toBe('kebab');
      expect(detectCase('header-navigation')).toBe('kebab');
    });

    it('should detect snake_case', () => {
      expect(detectCase('my_component')).toBe('snake');
      expect(detectCase('button_group')).toBe('snake');
      expect(detectCase('header_navigation')).toBe('snake');
    });

    it('should return null for invalid or mixed format', () => {
      expect(detectCase('My-Component')).toBeNull();
      expect(detectCase('MY_COMPONENT')).toBeNull();
      expect(detectCase('my component')).toBeNull();
      expect(detectCase('my.component')).toBeNull();
      expect(detectCase('123Component')).toBeNull();
    });
  });

  describe('transform', () => {
    const testCases = [
      {
        input: 'MyComponent',
        expected: {
          pascal: 'MyComponent',
          camel: 'myComponent',
          kebab: 'my-component',
          snake: 'my_component',
        },
      },
      {
        input: 'myComponent',
        expected: {
          pascal: 'MyComponent',
          camel: 'myComponent',
          kebab: 'my-component',
          snake: 'my_component',
        },
      },
      {
        input: 'my-component',
        expected: {
          pascal: 'MyComponent',
          camel: 'myComponent',
          kebab: 'my-component',
          snake: 'my_component',
        },
      },
      {
        input: 'my_component',
        expected: {
          pascal: 'MyComponent',
          camel: 'myComponent',
          kebab: 'my-component',
          snake: 'my_component',
        },
      },
      // Test with multiple words
      {
        input: 'UserProfileCard',
        expected: {
          pascal: 'UserProfileCard',
          camel: 'userProfileCard',
          kebab: 'user-profile-card',
          snake: 'user_profile_card',
        },
      },
      // Test with numbers
      {
        input: 'Button2',
        expected: {
          pascal: 'Button2',
          camel: 'button2',
          kebab: 'button-2',
          //   snake: 'button_2',
        },
      },
    ];

    testCases.forEach(({ input, expected }) => {
      Object.entries(expected).forEach(([targetCase, expectedOutput]) => {
        it(`should transform ${input} to ${targetCase}: ${expectedOutput}`, () => {
          expect(transform(input, targetCase as CaseType)).toBe(expectedOutput);
        });
      });
    });

    it('should return null for invalid input format', () => {
      expect(transform('My-Component', 'pascal')).toBeNull();
      expect(transform('123', 'camel')).toBeNull();
    });
  });

  describe('isValidCase', () => {
    it('should return true for valid case formats', () => {
      expect(isValidCase('MyComponent')).toBe(true);
      expect(isValidCase('myComponent')).toBe(true);
      expect(isValidCase('my-component')).toBe(true);
      expect(isValidCase('my_component')).toBe(true);
    });

    it('should return false for invalid case formats', () => {
      expect(isValidCase('My-Component')).toBe(false);
      expect(isValidCase('MY_COMPONENT')).toBe(false);
      expect(isValidCase('my component')).toBe(false);
      expect(isValidCase('-myComponent')).toBe(false);
      expect(isValidCase('_myComponent')).toBe(false);
    });
  });

  describe('getAllCaseVariants', () => {
    it('should generate all case variants for a valid input', () => {
      const variants = getAllCaseVariants('MyComponent');
      expect(variants).toEqual({
        pascal: 'MyComponent',
        camel: 'myComponent',
        kebab: 'my-component',
        snake: 'my_component',
      });
    });

    it('should handle multiple word components', () => {
      const variants = getAllCaseVariants('userProfileCard');
      expect(variants).toEqual({
        pascal: 'UserProfileCard',
        camel: 'userProfileCard',
        kebab: 'user-profile-card',
        snake: 'user_profile_card',
      });
    });

    it('should return null for all cases with invalid input', () => {
      const variants = getAllCaseVariants('My-Component');
      expect(variants).toEqual({
        pascal: null,
        camel: null,
        kebab: null,
        snake: null,
      });
    });
  });
});
