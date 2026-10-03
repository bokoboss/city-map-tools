export default async function globalTeardown() {
  const response = await fetch('http://127.0.0.1:4337/shutdown', { method: 'POST' });
  if (!response.ok) throw new Error(`Development browser server shutdown failed: ${response.status}`);
}
