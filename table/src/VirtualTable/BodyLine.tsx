import { useContext } from '@rc-component/context';
import classNames from 'classnames';
import * as React from 'react';
import Cell from '../Cell';
import TableContext, { responseImmutable } from '../context/TableContext';
import type { FlattenData } from '../hooks/useFlattenRecords';
import useRowInfo from '../hooks/useRowInfo';
import VirtualCell from './VirtualCell';
import { StaticContext } from './context';

export interface BodyLineProps<RecordType = any> {
  data: FlattenData<RecordType>;
  index: number;
  className?: string;
  style?: React.CSSProperties;
  rowKey: React.Key;

  /** Render cell only when it has `rowSpan > 1` */
  extra?: boolean;
  offsetX?: number;
  getHeight?: (rowSpan: number) => number;
  virtualColumInfo?: { leftIndex: number; rightIndex: number};
}

const BodyLine = React.forwardRef<HTMLDivElement, BodyLineProps>((props, ref) => {
  const { data, index, className, rowKey, style, extra, getHeight, offsetX, virtualColumInfo, ...restProps } = props;
  const { record, indent, index: renderIndex } = data;
  const { leftIndex, rightIndex } = virtualColumInfo;

  const { scrollX, flattenColumns, prefixCls, fixColumn, componentWidth } = useContext(
    TableContext,
    ['prefixCls', 'flattenColumns', 'fixColumn', 'componentWidth', 'scrollX'],
  );
  const { getComponent } = useContext(StaticContext, ['getComponent']);

  const rowInfo = useRowInfo(record, rowKey, index, indent);

  const RowComponent = getComponent(['body', 'row'], 'div');
  const cellComponent = getComponent(['body', 'cell'], 'div');

  // ========================== Expand ==========================
  const { rowSupportExpand, expanded, rowProps, expandedRowRender, expandedRowClassName } = rowInfo;

  let expandRowNode: React.ReactElement;
  if (rowSupportExpand && expanded) {
    const expandContent = expandedRowRender(record, index, indent + 1, expanded);
    const computedExpandedRowClassName = expandedRowClassName?.(record, index, indent);

    let additionalProps: React.TdHTMLAttributes<HTMLElement> = {};
    if (fixColumn) {
      additionalProps = {
        style: {
          ['--virtual-width' as any]: `${componentWidth}px`,
        },
      };
    }

    const rowCellCls = `${prefixCls}-expanded-row-cell`;

    expandRowNode = (
      <RowComponent
        className={classNames(
          `${prefixCls}-expanded-row`,
          `${prefixCls}-expanded-row-level-${indent + 1}`,
          computedExpandedRowClassName,
        )}
      >
        <Cell
          component={cellComponent}
          prefixCls={prefixCls}
          className={classNames(rowCellCls, {
            [`${rowCellCls}-fixed`]: fixColumn,
          })}
          additionalProps={additionalProps}
        >
          {expandContent}
        </Cell>
      </RowComponent>
    );
  }

  // ========================== Render ==========================
  const rowStyle: React.CSSProperties = {
    ...style,
    width: scrollX as number,
  };

  if (extra) {
    rowStyle.position = 'absolute';
    rowStyle.pointerEvents = 'none';
  }

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

  const cols = flattenColumns.slice(leftIndex, rightIndex || undefined);
  let offsetCount = 0;
  fixColMap.leftFixCols.forEach(key => {
    if (Number(key) < leftIndex) {
      cols.unshift(fixColMap.leftFix[key]);
      offsetCount++;
    }
  });
  fixColMap.rightFixCols.forEach(key => {
    if (Number(key) >= rightIndex || Number(key) < leftIndex) {
      cols.push(fixColMap.rightFix[key]);
    }
  });
  console.log("🚀 ~ BodyLine ~ list:", flattenColumns, cols, fixColMap)

  const rowNode = (
    <RowComponent
      {...rowProps}
      {...restProps}
      data-row-key={rowKey}
      ref={rowSupportExpand ? null : ref}
      className={classNames(className, `${prefixCls}-row`, rowProps?.className, {
        [`${prefixCls}-row-extra`]: extra,
      })}
      style={{ ...rowStyle, ...rowProps?.style }}
    >
      {cols.map((column, colIndex) => {
        return (
          <VirtualCell
            key={colIndex + leftIndex - offsetCount}
            component={cellComponent}
            rowInfo={rowInfo}
            column={column}
            colIndex={colIndex + leftIndex - offsetCount}
            indent={indent}
            index={index}
            renderIndex={renderIndex}
            record={record}
            inverse={extra}
            getHeight={getHeight}
          />
        );
      })}
    </RowComponent>
  );

  if (rowSupportExpand) {
    return (
      <div ref={ref}>
        {rowNode}
        {expandRowNode}
      </div>
    );
  }

  return rowNode;
});

const ResponseBodyLine = responseImmutable(BodyLine);

if (process.env.NODE_ENV !== 'production') {
  ResponseBodyLine.displayName = 'BodyLine';
}

export default ResponseBodyLine;
