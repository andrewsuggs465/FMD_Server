import { hashPasswordForLogin } from '@/lib/crypto';

onmessage = (ev: MessageEvent) => {
  const password = ev.data[0] as string;
  const salt = ev.data[1] as string;

  void hashPasswordForLogin(password, salt).then((passwordHash) => {
    postMessage(passwordHash);
  });
};
