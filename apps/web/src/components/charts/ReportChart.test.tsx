import { render } from "@testing-library/react";

import { ReportChart } from "./ReportChart";

const mocks = vi.hoisted(() => ({
  dispose: vi.fn(),
  hideLoading: vi.fn(),
  init: vi.fn(),
  resize: vi.fn(),
  setOption: vi.fn(),
  showLoading: vi.fn(),
}));

vi.mock("./echarts", () => ({
  init: mocks.init,
}));

describe("ReportChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.init.mockReturnValue({
      dispose: mocks.dispose,
      hideLoading: mocks.hideLoading,
      resize: mocks.resize,
      setOption: mocks.setOption,
      showLoading: mocks.showLoading,
    });
  });

  it("uses SVG, updates options and disposes its ECharts instance", () => {
    const firstOption = { aria: { enabled: true } };
    const secondOption = { aria: { enabled: true }, color: ["#287b60"] };
    const { rerender, unmount } = render(
      <ReportChart label="Test raporu" option={firstOption} busy />,
    );

    expect(mocks.init).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      undefined,
      expect.objectContaining({ renderer: "svg" }),
    );
    expect(mocks.setOption).toHaveBeenCalledWith(firstOption, {
      notMerge: true,
      lazyUpdate: true,
    });
    expect(mocks.showLoading).toHaveBeenCalled();

    rerender(<ReportChart label="Test raporu" option={secondOption} />);
    expect(mocks.setOption).toHaveBeenLastCalledWith(secondOption, {
      notMerge: true,
      lazyUpdate: true,
    });
    expect(mocks.hideLoading).toHaveBeenCalled();

    unmount();
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });
});
