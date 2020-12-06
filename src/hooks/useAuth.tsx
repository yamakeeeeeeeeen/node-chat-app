import { createContext, FC, useCallback, useContext, useEffect, useState } from 'react';
import { auth, db } from '~/config/firebase';
import { User as FirebaseUser } from '@firebase/auth-types';

type UserInfo = { uid: string; name: string; email: string };
export type SignUpData = { name: string; email: string; password: string };
export type SignInData = Omit<SignUpData, 'name'>;
type GetUserAdditionalData = (user: FirebaseUser) => Promise<void>;
type SignUP = (data: SignUpData) => Promise<void | { error: any }>;
type SignIn = ({ email, password }: SignInData) => Promise<FirebaseUser | { error: any }>;
type HandleAuthStateChanged = (user: FirebaseUser) => void;
type UseAuthProvider = () => { user: UserInfo; signUp: SignUP; signIn: SignIn };

// Provider hook that creates an auth object and handles it's state
const useAuthProvider: UseAuthProvider = () => {
  const [user, setUser] = useState(null);

  const createUser: (user: UserInfo) => Promise<void> = useCallback((user) => {
    return db
      .collection('users')
      .doc(user.uid)
      .set(user)
      .then(() => {
        console.log('Success');
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);

  const signUp: SignUP = useCallback(
    ({ name, email, password }) => {
      return auth
        .createUserWithEmailAndPassword(email, password)
        .then((response) => {
          return createUser({ uid: response.user.uid, email: email, name: name } as UserInfo);
        })
        .catch((error) => {
          console.log(error);
        });
    },
    [createUser],
  );

  const getUserAdditionalData: GetUserAdditionalData = useCallback((user: FirebaseUser) => {
    return db
      .collection('users')
      .doc(user.uid)
      .get()
      .then((userData) => {
        if (userData.data()) {
          setUser(userData.data());
        }
      });
  }, []);

  const signIn: SignIn = useCallback(
    ({ email, password }) => {
      return auth
        .signInWithEmailAndPassword(email, password)
        .then((response) => {
          setUser(response.user);
          getUserAdditionalData(user).then(() => {
            console.log('getUserAdditionalData is success');
          });
          return response.user;
        })
        .catch((error) => {
          return { error };
        });
    },
    [getUserAdditionalData, user],
  );

  const handleAuthStateChanged: HandleAuthStateChanged = useCallback(
    (user: FirebaseUser) => {
      setUser(user);
      if (user) {
        getUserAdditionalData(user).then();
      }
    },
    [getUserAdditionalData],
  );

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(handleAuthStateChanged);
    return () => unsub();
  }, [handleAuthStateChanged]);

  useEffect(() => {
    if (user?.uid) {
      // Subscribe to user document on mount
      const unsubscribe = db
        .collection('users')
        .doc(user.uid)
        .onSnapshot((doc) => setUser(doc.data()));
      return () => unsubscribe();
    }
  }, [user?.uid]);

  return {
    user,
    signUp,
    signIn,
  };
};

type AuthContext = { user: UserInfo | null; signUp: SignUP | null; signIn: SignIn | null };
type UseAuth = () => AuthContext;

const authContext = createContext<AuthContext>({ user: null, signUp: null, signIn: null });
const { Provider } = authContext;

export const AuthProvider: FC = ({ children }) => {
  const auth = useAuthProvider();
  return <Provider value={auth}>{children}</Provider>;
};

export const useAuth: UseAuth = () => {
  return useContext(authContext);
};
