import { Link } from "react-router-dom";

import PageMeta from "@/components/features/common/PageMeta";

export default function NotFound() {
  return (
    <>
      <PageMeta title="Page Not Found" description="" />
      <div className="z-1 relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6">
        <div className="mx-auto w-full max-w-[242px] text-center sm:max-w-[472px]">
          <h1 className="text-title-md xl:text-title-2xl mb-8 font-bold text-gray-800 dark:text-white/90">
            ERROR
          </h1>

          <img src="/images/error/404.svg" alt="404" className="dark:hidden" />
          <img
            src="/images/error/404-dark.svg"
            alt="404"
            className="hidden dark:block"
          />

          <p className="mb-6 mt-10 text-base text-gray-700 dark:text-gray-400 sm:text-lg">
            The page may have been deleted or does not exist. Please check the
            URL is correct.
          </p>

          <Link
            to="/"
            className="shadow-theme-xs inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
          >
            Back to home
          </Link>
        </div>
        {/* <!-- Footer --> */}
        <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-sm text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()}
        </p>
      </div>
    </>
  );
}
