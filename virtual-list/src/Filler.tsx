import * as React from 'react';
import ResizeObserver from 'rc-resize-observer';
import classNames from 'classnames';

export type InnerProps = Pick<React.HTMLAttributes<HTMLDivElement>, 'role' | 'id'>;

interface FillerProps {
  prefixCls?: string;
  /** Virtual filler height. Should be `count * itemMinHeight` */
  height: number;
  /** Set offset of visible items. Should be the top of start item position */
  offsetY?: number;
  offsetX?: number;

  scrollWidth?: number;

  children: React.ReactNode;

  onInnerResize?: () => void;

  innerProps?: InnerProps;

  rtl: boolean;

  extra?: React.ReactNode;

  columnWidthList?: number[];
}

/**
 * Fill component to provided the scroll content real height.
 */
const Filler = React.forwardRef(
  (
    {
      height,
      offsetY,
      offsetX,
      children,
      prefixCls,
      onInnerResize,
      innerProps,
      rtl,
      extra,
      columnWidthList = []
    }: FillerProps,
    ref: React.Ref<HTMLDivElement>,
  ) => {
    let outerStyle: React.CSSProperties = {};

    let innerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
    };

    let leftIndex = columnWidthList.findIndex(width => width >= offsetX) - 1;
    if (offsetY !== undefined) {
      // Not set `width` since this will break `sticky: right`
      outerStyle = {
        height,
        position: 'relative',
        overflow: 'hidden',
      };

      innerStyle = {
        ...innerStyle,
        transform: `translate(${-offsetX + (leftIndex >= 0 ? columnWidthList[leftIndex] : 0)}px, ${offsetY}px)`,// 需要增加前面删除的列宽
        // [rtl ? 'marginRight' : 'marginLeft']: -offsetX, 
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
      };
    }

    return (
      <div style={outerStyle}>
        <ResizeObserver
          onResize={({ offsetHeight }) => {
            if (offsetHeight && onInnerResize) {
              onInnerResize();
            }
          }}
        >
          <div
            style={innerStyle}
            className={classNames({
              [`${prefixCls}-holder-inner`]: prefixCls,
            })}
            ref={ref}
            {...innerProps}
          >
            {children}
            {extra}
          </div>
        </ResizeObserver>
      </div>
    );
  },
);

Filler.displayName = 'Filler';

export default Filler;
