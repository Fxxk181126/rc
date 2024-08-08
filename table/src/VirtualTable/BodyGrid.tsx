import { useContext } from '@rc-component/context';
import VirtualList, { type ListProps, type ListRef } from 'rc-virtual-list';
import * as React from 'react';
import TableContext, { responseImmutable } from '../context/TableContext';
import useFlattenRecords, { type FlattenData } from '../hooks/useFlattenRecords';
import type { ColumnType, OnCustomizeScroll, ScrollConfig } from '../interface';
import BodyLine from './BodyLine';
import { GridContext, StaticContext } from './context';

export interface GridProps<RecordType = any> {
  data: RecordType[];
  onScroll: OnCustomizeScroll;
}

export interface GridRef {
  scrollLeft: number;
  nativeElement: HTMLDivElement;
  scrollTo: (scrollConfig: ScrollConfig) => void;
}

const Grid = React.forwardRef<GridRef, GridProps>((props, ref) => {
  const { data, onScroll } = props;

  const {
    flattenColumns,
    onColumnResize,
    getRowKey,
    expandedKeys,
    prefixCls,
    childrenColumnName,
    scrollX,
    componentWidth
  } = useContext(TableContext, [
    'flattenColumns',
    'onColumnResize',
    'getRowKey',
    'prefixCls',
    'expandedKeys',
    'childrenColumnName',
    'scrollX',
    'componentWidth'
  ]);
  const {
    sticky,
    scrollY,
    listItemHeight,
    getComponent,
    onScroll: onTablePropScroll
  } = useContext(StaticContext);

  // =========================== Ref ============================
  const listRef = React.useRef<ListRef>();
  const [virtualColumInfo, setVirtualColumInfo] = React.useState<{ leftIndex: number; rightIndex: number; totalFixedWidth: number }>({ leftIndex: 0, rightIndex: undefined, totalFixedWidth: 0 });

  // =========================== Data ===========================
  const flattenData = useFlattenRecords(data, childrenColumnName, expandedKeys, getRowKey);

  // ========================== Column ==========================
  const columnsWidth = React.useMemo<[key: React.Key, width: number, total: number][]>(() => {
    let total = 0;
    return flattenColumns.map(({ width, key }) => {
      total += width as number;
      return [key, width as number, total];
    });
  }, [flattenColumns]);

  const columnsOffset = React.useMemo<number[]>(
    () => columnsWidth.map(colWidth => colWidth[2]),
    [columnsWidth],
  );

  React.useEffect(() => {
    columnsWidth.forEach(([key, width]) => {
      onColumnResize(key, width);
    });
  }, [columnsWidth]);

  // =========================== Ref ============================
  React.useImperativeHandle(ref, () => {
    const obj = {
      scrollTo: (config: ScrollConfig) => {
        listRef.current?.scrollTo(config);
      },
      nativeElement: listRef.current?.nativeElement,
    } as unknown as GridRef;

    Object.defineProperty(obj, 'scrollLeft', {
      get: () => listRef.current?.getScrollInfo().x || 0,

      set: (value: number) => {
        listRef.current?.scrollTo({
          left: value,
        });
      },
    });

    return obj;
  });

  // ======================= Col/Row Span =======================
  const getRowSpan = (column: ColumnType<any>, index: number): number => {
    const record = flattenData[index]?.record;
    const { onCell } = column;

    if (onCell) {
      const cellProps = onCell(record, index) as React.TdHTMLAttributes<HTMLElement>;
      return cellProps?.rowSpan ?? 1;
    }
    return 1;
  };

  const columnWidthList = React.useMemo(() => {
    let curTotalWidth = 0;
    return flattenColumns.reduce(function (acc, column, index) {
      curTotalWidth += (column.width || 0) as number;
      acc.push(curTotalWidth);

      return acc;
    }, []);
  }, [flattenColumns]);

  const fixColMap = React.useMemo(() => {
    return flattenColumns.reduce((acc, cur, index) => {
      if (cur.fixed == 'left') {
        acc.leftFixCols.unshift(index);
        acc.leftFix[index] = cur;
      } else if (cur.fixed == 'right') {
        acc.rightFixCols.push(index);
        acc.rightFix[index] = cur;
      }
  
      return acc;
    }, { leftFix: {}, rightFix: {}, leftFixCols: [], rightFixCols: [] });
  }, [flattenColumns]);

  const getColSpan = (column: ColumnType<any>, index: number): number => {
    const record = flattenData[index]?.record;
    const { onCell } = column;

    if (onCell) {
      const cellProps = onCell(record, index) as React.TdHTMLAttributes<HTMLElement>;
      return cellProps?.colSpan ?? 1;
    }
    return 1;
  };

  const offsetLeftIndexByColSpan = (leftIndex: number, index: number) => {
    if (getColSpan(flattenColumns[leftIndex], index) !== 0) {
      return leftIndex;
    }
    return offsetLeftIndexByColSpan(leftIndex - 1, index);
  }

  const onScrollX = (offsetX, start, end) => {
    const rightIndex = columnWidthList.findIndex(width => width >= (offsetX || 0)  + componentWidth) + 1 || undefined;
    const maxOffsetX = Math.max(columnWidthList[columnWidthList.length - 1] - componentWidth, 0);
    let leftIndex = columnWidthList.findIndex(width => width >= Math.min(offsetX, maxOffsetX));
    leftIndex = leftIndex >= 0 ? leftIndex : 0;
    const leftIndexList = [];
    for (let index = start; index <= end; index++) {
      leftIndexList.push(offsetLeftIndexByColSpan(leftIndex, index));
    }

    let totalFixedWidth = 0;
    fixColMap.leftFixCols.forEach(key => {
      if (Number(key) < leftIndex) {
        totalFixedWidth += columnWidthList[key];
      }
    });

    leftIndex = Math.min(...leftIndexList);
    setVirtualColumInfo({
      leftIndex: Math.min(Math.max(leftIndex - 0, 0), leftIndex),
      rightIndex: rightIndex,
      totalFixedWidth
    })
  }
  
  const extraRender: ListProps<any>['extraRender'] = info => {
    const { start, end, getSize, offsetY, offsetX } = info;
    var leftIndex = columnWidthList.findIndex(width => width >= offsetX);
    leftIndex = leftIndex >= 0 ? leftIndex : 0;
    // Do nothing if no data
    if (end < 0) {
      return null;
    }

    // Find first rowSpan column
    let firstRowSpanColumns = flattenColumns.filter(
      // rowSpan is 0
      column => getRowSpan(column, start) === 0,
    );
    let startIndex = start;
    for (let i = start; i >= 0; i -= 1) {
      firstRowSpanColumns = firstRowSpanColumns.filter(column => getRowSpan(column, i) === 0);

      if (!firstRowSpanColumns.length) {
        startIndex = i;
        break;
      }
    }

    // Find last rowSpan column
    let lastRowSpanColumns = flattenColumns.filter(
      // rowSpan is not 1
      column => getRowSpan(column, end) !== 1,
    );

    let endIndex = end;
    for (let i = end; i < flattenData.length; i += 1) {
      lastRowSpanColumns = lastRowSpanColumns.filter(column => getRowSpan(column, i) !== 1);

      if (!lastRowSpanColumns.length) {
        endIndex = Math.max(i - 1, end);
        break;
      }
    }

    // Collect the line who has rowSpan
    const spanLines: number[] = [];

    for (let i = startIndex; i <= endIndex; i += 1) {
      const item = flattenData[i];

      // This code will never reach, just incase
      if (!item) {
        continue;
      }
      if (flattenColumns.some(column => getRowSpan(column, i) > 1)) {
        spanLines.push(i);
      }
    }
    // Patch extra line on the page
    const nodes: React.ReactElement[] = spanLines.map(index => {
      const item = flattenData[index];
      const rowKey = getRowKey(item.record, index);

      const getHeight = (rowSpan: number) => {
        const endItemIndex = index + rowSpan - 1;
        const endItemKey = getRowKey(flattenData[endItemIndex].record, endItemIndex);

        const sizeInfo = getSize(rowKey, endItemKey);
        return sizeInfo.bottom - sizeInfo.top;
      };

      const sizeInfo = getSize(rowKey);

      return (
        <BodyLine
          key={index}
          data={item}
          rowKey={rowKey}
          index={index}
          style={{
            top: -offsetY + sizeInfo.top,
          }}
          offsetX={offsetX}
          virtualColumInfo={virtualColumInfo}
          extra
          getHeight={getHeight}
        />
      );
    });

    return nodes;
  };

  // ========================= Context ==========================
  const gridContext = React.useMemo(() => ({ columnsOffset }), [columnsOffset]);

  // ========================== Render ==========================
  const tblPrefixCls = `${prefixCls}-tbody`;

  // default 'div' in rc-virtual-list
  const wrapperComponent = getComponent(['body', 'wrapper']);

  // ========================== Sticky Scroll Bar ==========================
  const horizontalScrollBarStyle: React.CSSProperties = {};
  if (sticky) {
    horizontalScrollBarStyle.position = 'sticky';
    horizontalScrollBarStyle.bottom = 0;
    if (typeof sticky === 'object' && sticky.offsetScroll) {
      horizontalScrollBarStyle.bottom = sticky.offsetScroll;
    }
  }

  // 根据 scrollLeft 计算当前视图的显示脚标
  return (
    <GridContext.Provider value={gridContext}>
      <VirtualList<FlattenData<any>>
        fullHeight={false}
        ref={listRef}
        prefixCls={`${tblPrefixCls}-virtual`}
        styles={{ horizontalScrollBar: horizontalScrollBarStyle }}
        className={tblPrefixCls}
        height={scrollY}
        itemHeight={listItemHeight || 24}
        data={flattenData}
        itemKey={item => getRowKey(item.record)}
        component={wrapperComponent}
        scrollWidth={scrollX as number}
        onVirtualScroll={({ x }) => {
          onScroll({
            currentTarget: listRef.current?.nativeElement,
            scrollLeft: x,
          });
        }}
        onScroll={onTablePropScroll}
        onScrollX={onScrollX}
        virtualColumInfo={virtualColumInfo}
        columnWidthList={columnWidthList}
        extraRender={extraRender}
      >
        {(item, index, itemProps) => {
          const rowKey = getRowKey(item.record, index);
          return <BodyLine data={item} rowKey={rowKey} index={index} style={itemProps.style} offsetX={itemProps.offsetX} virtualColumInfo={virtualColumInfo}/>;
        }}
      </VirtualList>
    </GridContext.Provider>
  );
});

const ResponseGrid = responseImmutable(Grid);

if (process.env.NODE_ENV !== 'production') {
  ResponseGrid.displayName = 'ResponseGrid';
}

export default ResponseGrid;
