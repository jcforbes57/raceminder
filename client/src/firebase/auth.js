import firebase from './firebase';

const auth = firebase.auth();

// Sign Up
export const doCreateUserWithEmailAndPassword = (email, password) =>
  auth.createUserWithEmailAndPassword(email, password);

// Sign In
export const doSignInWithEmailAndPassword = (email, password) =>
  auth.signInWithEmailAndPassword(email, password);

export const doSignOut = () =>
  auth.signOut();

// Password Reset
export const doPasswordReset = (email) =>
  auth.sendPasswordResetEmail(email);

// Change Password
export const doPasswordUpdate = (password) =>
  auth.currentUser.updatePassword(password);
