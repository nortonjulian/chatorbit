import axios from './axiosClient';

export async function importContacts({ defaultCountry = 'US', contacts }) {
  const { data } = await axios.post('/contacts/import', { defaultCountry, contacts });
  return data;
}
