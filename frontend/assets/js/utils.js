import { nanoid } from '@reduxjs/toolkit';
import _ from 'lodash';
import DOMPurify from 'dompurify';
import parse from 'html-react-parser';

export const stringConvert = (s) => {
  // parse the authors string to create an array of objects
  // example "Rossi M., Caminata P., Sereni Allori C., Gallo M.S." -> [{firstName: M., LastName: Rossi}, ...]
  if (!s) return [];

  return s.split(/\s*,\s*/).map((author, index) => ({
    uid: nanoid(),
    name: author,
    affiliations: [],
    researchEntityId: null,
    position: index,
    isCorrespondingAuthor: false,
    isFirstCoauthor: false,
    isLastCoauthor: false,
    isOralPresentation: false,
  }));
};

// function that takes a numeric index and returns a letter
// 0->a, 1->b, ..., 26->aa, 27->ab, 28->ac, ...
export function indexToLetter(index) {
  let result = '';
  let i = index;
  while (i >= 0) {
    const remainder = i % 26;
    result = String.fromCharCode(remainder + 97) + result;
    i = Math.floor(i / 26) - 1;
  }
  return result;
}

export function findDifference(obj1, obj2, parentKey = '') {
  const diffKeys = [];

  // function to build full key path
  const buildKeyPath = (key) => (parentKey ? `${parentKey}.${key}` : key);

  // iterate first object
  Object.keys(obj1).forEach((key) => {
    const fullKey = buildKeyPath(key); // build the full key path
    // check if the key exists in the second object and if the values are not equal
    if (!(key in obj2)) {
      diffKeys.push(fullKey); // key exists in obj1 but not obj2
    } else if (!_.isEqual(obj1[key], obj2[key])) {
      // if both values are objects, call findDifference recursively
      if (
        typeof obj1[key] === 'object' &&
        typeof obj2[key] === 'object' &&
        obj1[key] !== null &&
        obj2[key] !== null
      ) {
        const nestedDiff = findDifference(obj1[key], obj2[key], fullKey);
        diffKeys.push(...nestedDiff); // append nested differences
      } else {
        diffKeys.push(fullKey); // directly add differing key path
      }
    }
  });

  // iterate through the second object to find any extra keys in obj2
  Object.keys(obj2).forEach((key) => {
    const fullKey = buildKeyPath(key);
    if (!(key in obj1)) {
      diffKeys.push(fullKey);
    }
  });

  // for (const key in diffKeys){ // check if it works in console log
  //     console.log(diffKeys[key]);
  // }
  return diffKeys;
}

// get all the affiliations starting from each author affiliation
export function getAffiliations(authors) {
  const affiliations = [];
  let count = 0;

  authors?.forEach((author) => {
    author.affiliations?.forEach((affiliation) => {
      if (
        !affiliations.find(
          (item) => item.instituteId === affiliation.instituteId
        )
      ) {
        affiliations.push({
          ...affiliation,
          letter: indexToLetter(count),
        });
        count += 1;
      }
    });
  });

  return affiliations;
}

export function fromKebabCase(string) {
  return string.replace('-', ' ');
}

export function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function getGroupType(type) {
  return type;
}

export function sanitizeAndParse(htmlString) {
  if (!htmlString) return null;

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const tag = node.tagName && node.tagName.toLowerCase();
    if (tag === 'img') return;
    if (tag === 'a') {
      const href = node.getAttribute('href') || '';
      if (href.startsWith('http://') || href.startsWith('https://')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener');
      } else node.removeAttribute('href');
    }
    if (node.hasAttribute('style')) node.removeAttribute('style');
  });

  const sanitizedHtml = DOMPurify.sanitize(htmlString, {
    FORBID_TAGS: ['font'],
  });

  return parse(sanitizedHtml);
}

export function getEmptyAuthor(position) {
  let pos = position;
  if (!pos) pos = 0;
  return {
    uid: nanoid(),
    name: '',
    affiliations: [],
    researchEntityId: null,
    position: pos,
    isCorrespondingAuthor: false,
    isFirstCoauthor: false,
    isLastCoauthor: false,
    isOralPresentation: false,
  };
}
