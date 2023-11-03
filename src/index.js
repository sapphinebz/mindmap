import {
  BehaviorSubject,
  Subject,
  fromEvent,
  merge,
  connectable,
  from,
  EMPTY,
  using,
  race,
} from "rxjs";
import {
  connect,
  debounce,
  distinctUntilChanged,
  exhaustMap,
  filter,
  finalize,
  map,
  mergeMap,
  share,
  shareReplay,
  switchMap,
  take,
  debounceTime,
  takeUntil,
  tap,
} from "rxjs/operators";

import { httpPost, httpGet } from "./http/http.js";

import { calculateDegLine } from "./svg/line.js";

window.addEventListener("DOMContentLoaded", (event) => {
  const onDocumentClick = fromEvent(document, "click").pipe(share());
  const onDocumentKeyDown = fromEvent(document, "keydown").pipe(share());
  const onDocumentKeyUp = fromEvent(document, "keyup").pipe(share());
  const onDocumentMouseDown = fromEvent(document, "mousedown").pipe(share());
  const onDocumentMouseUp = fromEvent(document, "mouseup").pipe(share());
  const onDocumentMouseMove = fromEvent(document, "mousemove").pipe(share());
  const getElementList = () => {
    return Array.from(document.body.querySelectorAll("[data-type]"));
  };

  const getLabelElementList = () => {
    return Array.from(document.body.querySelectorAll("[data-type=label]"));
  };
  const createHash = (type) => `${type}${new Date().getTime()}`;

  // constant
  const tapStopPropagation = tap((e) => e.stopPropagation());
  const filterMetaKey = filter((e) => e.metaKey);
  const filterShiftKey = filter((e) => e.shiftKey);
  const filterCodeShiftLeft = filter((e) => e.code === "ShiftLeft");
  const KEY_CODE_SPACE = "Space";
  const KEY_CODE_ESCAPE = "Escape";
  const filterCodeEscape = filter((e) => e.code === KEY_CODE_ESCAPE);
  const filterCodeSpace = filter((e) => e.code === KEY_CODE_SPACE);

  const onDocumentKeyDownSpacebar = onDocumentKeyDown.pipe(
    filterCodeSpace,
    share()
  );
  const onDocumentKeyUpSpacebar = onDocumentKeyUp.pipe(
    filterCodeSpace,
    share()
  );

  const onDocumentEscape = onDocumentKeyDown.pipe(filterCodeEscape, share());

  const onShiftLeft = onDocumentKeyDown.pipe(filterCodeShiftLeft, share());
  const onShiftLeftUp = onDocumentKeyUp.pipe(filterCodeShiftLeft, share());
  const onDocumentShiftClick = onDocumentClick.pipe(filterShiftKey, share());
  const onDocumentMetaMouseDown = onDocumentMouseDown.pipe(
    filterMetaKey,
    share()
  );
  const onDocumentMetaMouseMove = onDocumentMouseMove.pipe(
    filterMetaKey,
    share()
  );
  const onDocumentMetaMouseUp = onDocumentMouseUp.pipe(filterMetaKey, share());

  const translate$ = new BehaviorSubject({
    x: 0,
    y: 0,
  });

  const getInitialTranslation = (node) => {
    const computed = getComputedStyle(node);
    const left = Number(computed.left.replace("px", ""));
    const top = Number(computed.top.replace("px", ""));
    return { left: left - translate$.value.x, top: top - translate$.value.y };
  };

  const onEndSpacebarMove = new Subject();

  onDocumentKeyDownSpacebar
    .pipe(
      exhaustMap(() => {
        let startX = translate$.value.x;
        let startY = translate$.value.y;
        let isDirty = false;
        const commitUpdateOnDirty = tap(() => {
          if (isDirty) {
            onEndSpacebarMove.next();
          }
        });
        return onDocumentMouseDown.pipe(
          take(1),
          switchMap((downEvent) => {
            return onDocumentMouseMove.pipe(
              tap((moveEvent) => {
                const dx = moveEvent.x - downEvent.x + startX;
                const dy = moveEvent.y - downEvent.y + startY;
                translate$.next({ x: dx, y: dy });
                isDirty = true;
              }),
              takeUntil(onDocumentMouseUp.pipe(commitUpdateOnDirty))
            );
          }),
          takeUntil(onDocumentKeyUpSpacebar.pipe(commitUpdateOnDirty))
        );
      })
    )
    .subscribe();

  const lineTemplate = document.createElement("template");
  lineTemplate.innerHTML = `
  <div data-type="line" style="border-bottom: black 5px solid; position:fixed;transform-origin: 0 0;"></div>
  `;

  const labelTemplate = document.createElement("template");
  labelTemplate.innerHTML = `
  <div contenteditable="true" data-type="label">New Label</div>
  `;

  const onCreatedLineByClick = new Subject();
  const onRemovedLine = new Subject();
  const onShiftMoveLabel = new Subject();

  const loadedStorage$ = httpGet("/load").pipe(shareReplay(1));
  const loadedLabelList$ = loadedStorage$.pipe(
    switchMap((data) => {
      return from(data.filter((conf) => conf.type === "label")).pipe(
        map((conf) => {
          const fm = labelTemplate.content.cloneNode(true);
          const labelNode = fm.children[0];
          labelNode.style.position = "fixed";
          labelNode.style.left = conf.left;
          labelNode.style.top = conf.top;
          labelNode.setAttribute("id", conf.id);
          labelNode.style.fontSize = conf.fontSize;
          labelNode.innerText = conf.innerText ?? "New xxx";
          labelNode.style.width = "max-content";
          labelNode.style.maxWidth = "150px";
          labelNode.style.userSelect = "none";
          document.body.appendChild(fm);
          return conf.id;
        })
      );
    }),
    shareReplay()
  );
  const loadedLineList$ = loadedStorage$.pipe(
    switchMap((data) => {
      return from(data.filter((conf) => conf.type === "line")).pipe(
        map((conf) => {
          const fm = lineTemplate.content.cloneNode(true);

          const lineNode = fm.children[0];
          lineNode.setAttribute("id", conf.id);
          lineNode.style.left = conf.left;
          lineNode.style.top = conf.top;
          lineNode.style.width = conf.width;
          lineNode.style.rotate = conf.rotate;
          document.body.appendChild(fm);
          return conf.id;
        })
      );
    }),
    shareReplay()
  );

  const onCreatedLine = merge(onCreatedLineByClick, loadedLineList$).pipe(
    share()
  );

  onCreatedLine
    .pipe(
      mergeMap((id) => {
        const lineNode = document.querySelector(`#${id}`);
        return fromEvent(lineNode, "click").pipe(
          switchMap(() => {
            if (lineNode.style.borderColor) {
              lineNode.style.borderColor = "";
              return EMPTY;
            }
            lineNode.style.borderColor = "red";
            return onDocumentEscape.pipe(
              tap(() => {
                onRemovedLine.next(id);
              })
            );
          }),
          take(1)
        );
      })
    )
    .subscribe();

  onDocumentMetaMouseDown
    .pipe(
      exhaustMap((downEvent) => {
        const fm = lineTemplate.content.cloneNode(true);
        const lineNode = fm.children[0];
        const id = createHash("line");
        lineNode.setAttribute("id", id);

        lineNode.style.left = `${downEvent.x}px`;
        lineNode.style.top = `${downEvent.y}px`;

        document.body.append(fm);

        return onDocumentMetaMouseMove.pipe(
          tap((moveEvent) => {
            const distance = Math.hypot(
              moveEvent.x - downEvent.x,
              moveEvent.y - downEvent.y
            );
            lineNode.style.width = `${distance}px`;

            const deg = calculateDegLine(downEvent, moveEvent);

            lineNode.style.rotate = `${deg}deg`;
          }),
          takeUntil(
            onDocumentMetaMouseUp.pipe(
              tap(() => {
                onCreatedLineByClick.next(id);
              })
            )
          )
        );
      })
    )
    .subscribe();

  const onClickNewLabel = onDocumentShiftClick;

  const onCreatedLabelByClick = onClickNewLabel.pipe(
    map((event) => {
      const x = event.x;
      const y = event.y;
      const fm = labelTemplate.content.cloneNode(true);
      const firstNode = fm.children[0];
      firstNode.style.position = "fixed";
      firstNode.style.left = `${x}px`;
      firstNode.style.top = `${y}px`;
      const id = createHash("label");
      firstNode.setAttribute("id", id);
      document.body.appendChild(fm);
      return id;
    }),
    share()
  );

  const onCreatedLabel = merge(onCreatedLabelByClick, loadedLabelList$).pipe(
    share()
  );

  const onRemovedLabel = new Subject();

  onCreatedLabel
    .pipe(
      mergeMap((id) => {
        const node = document.querySelector(`#${id}`);
        return fromEvent(node, "keydown").pipe(
          filterCodeEscape,
          tap(() => {
            node.remove();
            onRemovedLabel.next(id);
          }),
          take(1)
        );
      })
    )
    .subscribe();

  // const labelDestroyedMap = new Map();

  // const takeUntilDestroyed = (id) => {
  //   let onDestroy = labelDestroyedMap.get(id);
  //   if (!onDestroy) {
  //     onDestroy = onEscapeLabel.pipe(
  //       filter((idAttr) => {
  //         if (idAttr === id) {
  //           const node = document.querySelector(`#${id}`);
  //           node.remove();
  //           labelDestroyedMap.delete(id);
  //           onRemovedLabel.next(id);
  //           return true;
  //         }
  //         return false;
  //       }),
  //       share()
  //     );
  //     labelDestroyedMap.set(id, onDestroy);
  //   }
  //   return takeUntil(onDestroy);
  // };

  const translationMap = new Map();
  merge(onCreatedLabel, onShiftMoveLabel).subscribe((id) => {
    let subscription = translationMap.get(id);
    if (subscription) {
      subscription.unsubscribe();
    }
    const node = document.querySelector(`#${id}`);

    const { left, top } = getInitialTranslation(node);
    subscription = translate$.subscribe((changes) => {
      node.style.left = `${left + changes.x}px`;
      node.style.top = `${top + changes.y}px`;
      // node.style.transform = `translate(${changes.x}px, ${changes.y}px)`;
    });

    translationMap.set(id, subscription);
  });

  onRemovedLabel.subscribe((id) => {
    let subscription = translationMap.get(id);
    if (subscription) {
      subscription.unsubscribe();
    }
  });

  // onCreateNewLabel
  //   .pipe(
  //     mergeMap((id) => {
  //       const node = document.querySelector(`#${id}`);

  //       const { left, top } = getInitialTranslation(node);
  //       return translate$.pipe(
  //         tap((changes) => {
  //           node.style.left = `${left + changes.x}px`;
  //           node.style.top = `${top + changes.y}px`;
  //           // node.style.transform = `translate(${changes.x}px, ${changes.y}px)`;
  //         }),
  //         takeUntilDestroyed(id)
  //       );
  //     })
  //   )
  //   .subscribe();

  const lineDestroyedMap = new Map();
  const takeUntilLineDestroyed = (id) => {
    let onDestroy = lineDestroyedMap.get(id);
    if (!onDestroy) {
      onDestroy = onRemovedLine.pipe(
        filter((idAttr) => {
          if (idAttr === id) {
            const lineNode = document.querySelector(`#${id}`);
            lineNode.remove();
            lineDestroyedMap.delete(id);
            return true;
          }
          return false;
        }),
        share()
      );
      lineDestroyedMap.set(id, onDestroy);
    }
    return takeUntil(onDestroy);
  };

  onCreatedLine
    .pipe(
      mergeMap((id) => {
        const node = document.querySelector(`#${id}`);
        let { left, top } = getInitialTranslation(node);
        return translate$.pipe(
          tap((changes) => {
            // node.style.transform = `translate(${changes.x}px, ${changes.y}px)`;
            node.style.left = `${left + changes.x}px`;
            node.style.top = `${top + changes.y}px`;
          }),
          takeUntilLineDestroyed(id)
        );
      })
    )
    .subscribe();

  const takeUntilDestroyed = (id) =>
    takeUntil(onRemovedLabel.pipe(filter((_id) => id === _id)));

  const fromEventLabel = (eventName) => {
    return onCreatedLabel.pipe(
      mergeMap((id) => {
        const node = document.querySelector(`#${id}`);
        return fromEvent(node, eventName, { capture: true }).pipe(
          tapStopPropagation,
          takeUntilDestroyed(id)
        );
      }),
      share()
    );
  };

  const onInitEditLabel = fromEventLabel("click");
  const onAfterEditLabel = onInitEditLabel.pipe(
    switchMap((event) => {
      const node = event.target;
      return fromEvent(node, "blur").pipe(
        tap(() => {
          if (node.innerText.trim() === "") {
            node.innerText = "New Label";
          }
        })
      );
    }),
    share()
  );
  const onFocusLabel = fromEventLabel("focus");

  // const onBlurLabel = fromEventLabel("blur");

  onShiftLeft
    .pipe(
      exhaustMap(() => {
        const els = getLabelElementList();
        return race(
          els.map((el) => {
            const onMouseOver = fromEvent(el, "mouseover", {
              capture: true,
            });

            const onMouseMove = fromEvent(el, "mousemove", {
              capture: true,
            });

            const onOver = merge(onMouseOver, onMouseMove).pipe(
              map(() => "move")
            );
            const onMouseOut = fromEvent(el, "mouseout").pipe(
              map(() => {
                return "default";
              })
            );
            let isDirty = false;
            const id = el.getAttribute("id");
            return merge(onOver, onMouseOut).pipe(
              distinctUntilChanged(),
              exhaustMap((cursor) => {
                el.style.cursor = cursor;
                if (cursor === "move") {
                  return fromEvent(el, "mousedown").pipe(
                    exhaustMap((downEvent) => {
                      const computed = getComputedStyle(el);
                      const left = Number(computed.left.replace("px", ""));
                      const top = Number(computed.top.replace("px", ""));
                      return fromEvent(document, "mousemove").pipe(
                        tap((moveEvent) => {
                          isDirty = true;
                          const dx = moveEvent.x - downEvent.x + left;
                          const dy = moveEvent.y - downEvent.y + top;
                          el.style.left = `${dx}px`;
                          el.style.top = `${dy}px`;
                        }),
                        takeUntil(fromEvent(document, "mouseup"))
                      );
                    })
                  );
                }

                return EMPTY;
              }),
              finalize(() => {
                el.style.cursor = "default";
                if (isDirty) {
                  onShiftMoveLabel.next(id);
                }
              })
            );
          })
        ).pipe(takeUntil(onShiftLeftUp));
      })
    )
    .subscribe();

  const onSizeLabelChange = onFocusLabel.pipe(
    switchMap((focusEvent) => {
      return fromEvent(document, "keydown").pipe(
        connect((keydown$) => {
          const fromShiftKey = (key) =>
            keydown$.pipe(
              filter((event) => event.key === key && event.shiftKey)
            );

          const setFontSize = (project) => {
            const compute = getComputedStyle(focusEvent.target);
            const fontSize = Number(compute.fontSize.replace("px", ""));
            const newSize = project(fontSize);
            focusEvent.target.style.fontSize = `${newSize}px`;
          };

          const onSizeUp = fromShiftKey("ArrowUp").pipe(
            tap(() => {
              setFontSize((size) => size + 2);
            })
          );

          const onSizeDown = fromShiftKey("ArrowDown").pipe(
            tap(() => {
              setFontSize((size) => size - 2);
            })
          );

          return merge(onSizeUp, onSizeDown);
        })
      );
    })
  );

  onInitEditLabel.subscribe();

  onFocusLabel.subscribe();

  const onCommitUpdateChanges = merge(
    onCreatedLabelByClick,
    onRemovedLabel,
    onSizeLabelChange,
    onAfterEditLabel,
    onShiftMoveLabel,
    onCreatedLineByClick,
    onRemovedLine,
    onEndSpacebarMove
  ).pipe(debounceTime(0), share());

  onCommitUpdateChanges
    .pipe(
      switchMap(() => {
        const els = getElementList();

        const saveStated = els.reduce((state, el) => {
          const id = el.getAttribute("id");
          if (el.dataset.type === "label") {
            const computed = getComputedStyle(el);

            state.push({
              type: el.dataset.type,
              left: computed.left,
              top: computed.top,
              id,
              fontSize: computed.fontSize,
              innerText: el.innerText,
            });
          } else if (el.dataset.type === "line") {
            const computed = getComputedStyle(el);
            state.push({
              type: el.dataset.type,
              left: computed.left,
              top: computed.top,
              id,
              width: computed.width,
              rotate: computed.rotate,
            });
          }

          return state;
        }, []);

        return httpPost("/update", saveStated).pipe(
          tap(() => {
            console.log("save success !");
          })
        );
      })
    )
    .subscribe();
});
