import { FacebookSDK } from "@/components/facebook-sdk";

export default function ConnectFacebookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <FacebookSDK />
      {children}
    </>
  );
}
