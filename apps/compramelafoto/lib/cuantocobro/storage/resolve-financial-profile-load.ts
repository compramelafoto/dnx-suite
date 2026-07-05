export async function resolveFinancialProfileLoad<T>(options: {
  userId: number | null;
  loadRemote: () => Promise<T | null>;
  loadLocal: () => Promise<T>;
  saveRemote: (profile: T) => Promise<void>;
}): Promise<T> {
  if (!options.userId) {
    return options.loadLocal();
  }

  const remote = await options.loadRemote();
  if (remote !== null) {
    return remote;
  }

  const localProfile = await options.loadLocal();

  try {
    await options.saveRemote(localProfile);
  } catch {
    /* Sin red o sin sesión: seguir con local sin bloquear el wizard */
  }

  return localProfile;
}

export async function persistFinancialProfile<T>(options: {
  userId: number | null;
  profile: T;
  saveRemote: (profile: T) => Promise<void>;
  saveLocal: (profile: T) => Promise<void>;
}): Promise<void> {
  if (options.userId) {
    try {
      await options.saveRemote(options.profile);
    } catch {
      /* Fallback: al menos persistir en local */
    }
  }

  await options.saveLocal(options.profile);
}
