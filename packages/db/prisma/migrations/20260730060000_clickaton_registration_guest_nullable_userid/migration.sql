-- Guest registration: defer DNX User until payment approved / free confirm.
ALTER TABLE "ClickatonRegistration" ALTER COLUMN "userId" DROP NOT NULL;
