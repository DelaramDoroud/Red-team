export function wrapCppCode(userCode) {
  // Try to extract code from user's main function if it exists
  let userCodeToInsert = userCode;

  // Check if user code has int main() - handle nested braces
  const mainStartMatch = userCode.match(/int\s+main\s*\([^)]*\)\s*\{/);
  if (mainStartMatch) {
    const startIndex = mainStartMatch.index + mainStartMatch[0].length;
    let braceCount = 1;
    let endIndex = startIndex;

    // Find matching closing brace
    for (let i = startIndex; i < userCode.length && braceCount > 0; i++) {
      if (userCode[i] === '{') braceCount++;
      if (userCode[i] === '}') braceCount--;
      if (braceCount === 0) {
        endIndex = i;
        break;
      }
    }

    if (endIndex > startIndex) {
      // Extract content inside main function and preserve indentation
      userCodeToInsert = userCode.substring(startIndex, endIndex).trim();
    }
  }

  // If user code doesn't have main, we need to indent it
  if (!mainStartMatch) {
    userCodeToInsert = userCode
      .split('\n')
      .map((line) => (line.trim() === '' ? '' : '    ' + line))
      .join('\n');
  }

  const wrapper = `#include <iostream>
#include <string>
#include <sstream>

// Read and parse input from stdin
std::string readInput() {
    std::string input;
    std::string line;
    while (std::getline(std::cin, line)) {
        input += line;
    }
    return input;
}

int main() {
    // Read JSON input from stdin
    std::string input_data_str = readInput();
    
    // User's code
${userCodeToInsert}
    
    // Result section
    // Your output will be captured from stdout
    // For best results, output JSON format compatible with the test expectations
    return 0;
}
`;

  return wrapper;
}

export const cppWrapperMeta = {
  supportedLanguages: ['cpp', 'c++', 'cplusplus'],
  description:
    'C++ wrapper that reads JSON input from stdin and provides input_data_str variable',
  version: '^1.0.0',
};
