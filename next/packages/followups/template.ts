import { createElement } from "react";
import { Body, Head, Html, Text, Container } from "@react-email/components";
import { render } from "@react-email/render";
import type { Draft } from "./domain.ts";
import type { Email } from "../notifications/domain.ts";
import type { Locale } from "../i18n/messages.ts";
export async function followupEmail(
  draft: Draft,
  locale: Locale,
): Promise<Email> {
  const html = await render(
    createElement(
      Html,
      { lang: locale },
      createElement(Head),
      createElement(
        Body,
        { style: { fontFamily: "Arial, sans-serif", color: "#222" } },
        createElement(
          Container,
          { style: { padding: "24px" } },
          createElement(
            Text,
            {
              style: {
                margin: "0",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              },
            },
            draft.body,
          ),
        ),
      ),
    ),
  );
  return {
    to: draft.recipient,
    subject: draft.subject,
    text: draft.body,
    html,
  };
}
