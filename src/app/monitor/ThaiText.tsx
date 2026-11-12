// A title that breaks lines only where Thai allows (lib/monitor/thai-wrap.ts).
import { Fragment } from "react";
import { thaiPieces } from "@/lib/monitor/thai-wrap";

export function ThaiText({ text }: { text: string }) {
  const chunks = thaiPieces(text);
  return (
    <>
      {chunks.map((pieces, i) => (
        <Fragment key={i}>
          {i > 0 ? " " : null}
          {pieces.map((p, k) => (
            <Fragment key={k}>
              {k > 0 ? <wbr /> : null}
              <span className="th-nb">{p}</span>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </>
  );
}
