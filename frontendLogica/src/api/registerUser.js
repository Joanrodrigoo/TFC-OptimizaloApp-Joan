export const registerUser = async (data) => {
  const response = await fetch(`${import.meta.env.VITE_API_URL || "https://optimizalo.app"}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al registrar usuario');
  }

  return await response.json();
};