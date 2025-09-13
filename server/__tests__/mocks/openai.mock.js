// ESM mock for 'openai'
export default class OpenAI {
  constructor() {}
  chat = {
    completions: {
      create: async () => ({
        choices: [
          { message: { content: JSON.stringify({ suggestions: [] }) } }
        ],
      }),
    },
  };
}
module.exports = FakeOpenAI;
module.exports.default = FakeOpenAI;
