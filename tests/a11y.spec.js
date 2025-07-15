// @ts-check
import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';
import * as fs from 'node:fs/promises';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const gemini = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const url =
  'https://www.conet.de/blog/sap-fiori-sap-screen-personas-das-beste-aus-zwei-welten/';

const extractA11yTestResults = (results) =>
  results.violations
    .reduce((acc, v) => [...acc, ...v.nodes], [])
    .map((v) => ({
      id: v.any[0].id,
      data: v.any[0].data,
      message: v.any[0].message,
      impact: v.impact,
      html: v.html,
      target: v.target,
      failureSummary: v.failureSummary,
    }));

test('A11y', async ({ page }) => {
  await page.goto(url);
  const a11yResults = await new AxeBuilder({ page })
    .withTags(['wcag2aa'])
    .analyze();

  const results = extractA11yTestResults(a11yResults);

  if (results?.length > 0) {
    try {
      // await createSolutions(results);
    } catch (err) {
      console.error(err);
    }
  }
});

const createSolutions = async (report) => {
  const response = await gemini.models.generateContent({
    model: 'gemini-2.0-flash-001',
    contents: `
        Please have a look at this data: ${report}.
        The data contains a report with accessibility issues found on the site ${url}.
        The  report contains an array with one object for each accessibility issue found.
        Each object of the accessibility issues contains a field "nodes", which contains one object for each occurence of the accessibility violation found.
       
        Here is an explanation of each of the relevant fields which are present in each of the objects containing a violation:

        "id" is the identification of the accessbility violation, assigned by axe-core engine.
        "data" contains detailed information of the values that caused the issue.
        "impact" is the level of the violation.
        "message" describes the issue found in detail.
        "html" is the concrete HTML element which created the violation.
        "target" is an array with the CSS selector used to locate the violating element.
        "failureSummary" gives indications how to solve the issue.

        Please do the following:
        Go through each of the issues in the "nodes" array, which you will find in the data. And come up with a code change to fix the issue. For each of the issues provide only one suggestion.
        For each issue please create one object. The object should have the following structure:
        - "violation": should contain the id of the violation from the issue object.
        - "target": should contain the same value as the "target" field in the issue object.
        - "html": should contain the same value as the "html" field in the issue object.
        - "solution": using the solution you came up with for this issue, this field should contain a string with HTML code which represents the change you came up with and which resembles a code diff in a MR on Gitlab or Github. Something similar to this, so that we can display the suggestion on a website and style it as a diff:
          \`\`\`diff
          - <div role="foobar">
          + <div role="region">
          \`\`\`
              
        When you have processed all the issues and finished creating the JSON with the solutions for all the issues, please return it in your response.
      `,
  });

  console.log(response?.candidates?.[0]?.content?.parts?.[0]?.text);
};
